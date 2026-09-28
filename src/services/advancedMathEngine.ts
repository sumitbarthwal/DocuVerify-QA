import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

export interface TableCalculationAudit {
  tableName: string;
  columnName: string;
  calculatedSum: number;
  reportedSum: number;
  currencySymbol?: string;
  difference: number;
  status: 'valid' | 'mismatch';
  lineNumber: number;
  rawTotalCell: string;
  suggestedTotalCell: string;
}

export interface DualExpressionPair {
  numericStr: string;
  numericVal: number;
  wordsStr: string;
  wordsVal: number;
  isMatch: boolean;
  difference: number;
  rawText: string;
  lineNumber: number;
}

/**
 * Word to Number dictionary for English and Commonwealth/Indian counting terms
 */
const SMALL_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const MAGNITUDES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  million: 1000000,
  millions: 1000000,
  crore: 10000000,
  crores: 10000000,
  billion: 1000000000,
  billions: 1000000000,
};

/**
 * Converts English written number string (e.g. "One Million Two Hundred Thousand", "Fifty-Five Thousand") to a number.
 */
export function wordsToNumber(text: string): number | null {
  const cleaned = text
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/[,\.]/g, '')
    .trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let currentGroup = 0;
  let hasValidNumberWord = false;

  for (const token of tokens) {
    if (SMALL_NUMBERS[token] !== undefined) {
      currentGroup += SMALL_NUMBERS[token];
      hasValidNumberWord = true;
    } else if (token === 'hundred') {
      currentGroup = (currentGroup || 1) * 100;
      hasValidNumberWord = true;
    } else if (MAGNITUDES[token] !== undefined) {
      const mag = MAGNITUDES[token];
      total += (currentGroup || 1) * mag;
      currentGroup = 0;
      hasValidNumberWord = true;
    } else {
      // Ignored currency terms or non-numeric words (dollars, rupees, only, etc.)
    }
  }

  total += currentGroup;
  return hasValidNumberWord ? total : null;
}

/**
 * Parses financial figures from cell strings like "$12,450.00", "₹ 5,00,000", "(2,500)"
 */
function parseFinancialCell(str: string): { value: number; currency?: string; raw: string } | null {
  const clean = str.trim();
  if (!clean) return null;

  // Extract currency
  const currMatch = clean.match(/[$€£¥₹]|USD|EUR|GBP|INR|Rs\.?/i);
  const currency = currMatch ? currMatch[0] : undefined;

  // Check for negative in parentheses: (1,200) -> -1200
  let isNegative = false;
  if (/^\(.*\)$/.test(clean) || clean.startsWith('-')) {
    isNegative = true;
  }

  // Strip non-numeric except digits and dot
  const numPart = clean.replace(/[$€£¥₹a-zA-Z,\s\(\)]/g, '');
  if (!numPart || isNaN(Number(numPart))) return null;

  const val = parseFloat(numPart) * (isNegative ? -1 : 1);
  return { value: val, currency, raw: clean };
}

/**
 * Intelligent Table Math & Arithmetic Column/Row Checker
 */
export function verifyTableCalculations(documentText: string): {
  issues: QAIssue[];
  tableAudits: TableCalculationAudit[];
} {
  const issues: QAIssue[] = [];
  const tableAudits: TableCalculationAudit[] = [];
  let idCounter = 1;

  const lines = documentText.split('\n');
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: { cells: string[]; rawLine: string; lineIndex: number }[] = [];
  let tableTitle = 'Document Table';
  let tableStartIndex = 0;

  const processCurrentTable = () => {
    if (tableRows.length < 2 || tableHeader.length < 2) return;

    // Check each column for numbers
    const numCols = tableHeader.length;

    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      const colName = tableHeader[colIdx] || `Column ${colIdx + 1}`;
      
      // Look for a row labeled Total or Subtotal
      let totalRowIndex = -1;
      let totalCellRaw = '';
      let isTotalRow = false;

      for (let r = tableRows.length - 1; r >= 0; r--) {
        const firstFewCells = tableRows[r].cells.slice(0, 3).join(' ').toLowerCase();
        if (/(?:total|subtotal|grand\s*total|net\s*payable|sum|aggregate)/i.test(firstFewCells)) {
          totalRowIndex = r;
          totalCellRaw = tableRows[r].cells[colIdx] || '';
          isTotalRow = true;
          break;
        }
      }

      if (totalRowIndex > 0) {
        const parsedTotal = parseFinancialCell(totalCellRaw);
        if (!parsedTotal) continue;

        // Sum up preceding items in this column
        let calculatedSum = 0;
        let validItemCount = 0;
        let lastCurrency = parsedTotal.currency;

        for (let r = 0; r < totalRowIndex; r++) {
          const cellVal = parseFinancialCell(tableRows[r].cells[colIdx] || '');
          if (cellVal && !isNaN(cellVal.value)) {
            calculatedSum += cellVal.value;
            validItemCount++;
            if (!lastCurrency && cellVal.currency) {
              lastCurrency = cellVal.currency;
            }
          }
        }

        if (validItemCount >= 2) {
          const diff = Math.abs(calculatedSum - parsedTotal.value);
          const hasMismatch = diff > 0.05; // 5 cents margin for floating point

          const currPrefix = lastCurrency ? `${lastCurrency} ` : '';
          const formattedCalculated = `${currPrefix}${calculatedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const formattedReported = `${currPrefix}${parsedTotal.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

          const totalRow = tableRows[totalRowIndex];
          const lineNum = totalRow.lineIndex + 1;

          tableAudits.push({
            tableName: tableTitle,
            columnName: colName,
            calculatedSum,
            reportedSum: parsedTotal.value,
            currencySymbol: lastCurrency,
            difference: parsedTotal.value - calculatedSum,
            status: hasMismatch ? 'mismatch' : 'valid',
            lineNumber: lineNum,
            rawTotalCell: totalCellRaw,
            suggestedTotalCell: formattedCalculated,
          });

          if (hasMismatch) {
            const rawLine = totalRow.rawLine;
            const startOffset = documentText.indexOf(rawLine);
            const fixedLine = rawLine.replace(totalCellRaw, formattedCalculated);

            issues.push({
              id: `math-table-sum-${idCounter++}`,
              category: 'data-continuity',
              severity: 'critical',
              title: `Arithmetic Mismatch in Table: ${colName}`,
              description: `In "${tableTitle}", the reported ${colName} Total (${formattedReported}) does not match the sum of its row items (${formattedCalculated}). Discrepancy: ${currPrefix}${(parsedTotal.value - calculatedSum).toFixed(2)}.`,
              originalText: rawLine.trim(),
              suggestedText: fixedLine.trim(),
              startOffset: startOffset >= 0 ? startOffset : 0,
              endOffset: startOffset >= 0 ? startOffset + rawLine.length : 0,
              lineNumber: lineNum,
              ruleId: 'table-column-summation',
              autoApplicable: true,
              explanation: `Sum of ${validItemCount} rows in column "${colName}" is ${formattedCalculated}. The reported total of ${formattedReported} is mathematically inconsistent.`,
            });
          }
        }
      }
    }

    // Horizontal Row Verification: Quantity * Rate = Total
    let qtyColIdx = -1;
    let rateColIdx = -1;
    let amtColIdx = -1;

    tableHeader.forEach((h, idx) => {
      const lower = h.toLowerCase();
      if (/(?:quantity|qty|units|nos|hours)/i.test(lower)) qtyColIdx = idx;
      if (/(?:rate|unit\s*price|price\/unit|cost\/unit|fee\/hr)/i.test(lower)) rateColIdx = idx;
      if (/(?:amount|subtotal|total\s*cost|price|net)/i.test(lower) && !/(?:unit)/i.test(lower)) amtColIdx = idx;
    });

    if (qtyColIdx >= 0 && rateColIdx >= 0 && amtColIdx >= 0) {
      for (let r = 0; r < tableRows.length; r++) {
        const row = tableRows[r];
        const firstCell = (row.cells[0] || '').toLowerCase();
        if (/(?:total|subtotal|sum|aggregate)/i.test(firstCell)) continue;

        const qty = parseFinancialCell(row.cells[qtyColIdx] || '');
        const rate = parseFinancialCell(row.cells[rateColIdx] || '');
        const amt = parseFinancialCell(row.cells[amtColIdx] || '');

        if (qty && rate && amt && qty.value > 0 && rate.value > 0) {
          const expected = qty.value * rate.value;
          const diff = Math.abs(expected - amt.value);
          if (diff > 0.5) {
            const curr = amt.currency || rate.currency || '$';
            const fixedAmtStr = `${curr}${expected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const rawCell = row.cells[amtColIdx];
            const startOffset = documentText.indexOf(row.rawLine);

            issues.push({
              id: `math-row-eq-${idCounter++}`,
              category: 'data-continuity',
              severity: 'critical',
              title: `Row Calculation Mismatch: ${row.cells[0] || 'Item'}`,
              description: `Quantity (${qty.value}) × Rate (${curr}${rate.value}) equals ${fixedAmtStr}, but the amount is listed as ${rawCell}.`,
              originalText: row.rawLine.trim(),
              suggestedText: row.rawLine.replace(rawCell, fixedAmtStr).trim(),
              startOffset: startOffset >= 0 ? startOffset : 0,
              endOffset: startOffset >= 0 ? startOffset + row.rawLine.length : 0,
              lineNumber: row.lineIndex + 1,
              ruleId: 'row-multiplication-integrity',
              autoApplicable: true,
              explanation: `Itemized pricing must accurately reflect the product of Quantity and Unit Rate (${qty.value} × ${rate.value} = ${expected}).`,
            });
          }
        }
      }
    }
  };

  // Parse lines to detect tables
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if line before table is a title: e.g. "Table 1: Assessment of Loss"
    if (/^(?:table|schedule|annexure)\s*\d*\s*[:–-]/i.test(line)) {
      tableTitle = line;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Delimiter row
      if (cells.every((c) => /^[-:\s]+$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
        tableRows = [];
        tableStartIndex = i;
      } else {
        tableRows.push({ cells, rawLine: lines[i], lineIndex: i });
      }
    } else {
      if (inTable) {
        processCurrentTable();
        inTable = false;
        tableHeader = [];
        tableRows = [];
        tableTitle = 'Document Table';
      }
    }
  }

  if (inTable) {
    processCurrentTable();
  }

  return { issues, tableAudits };
}

/**
 * Intelligent Dual Expression Verification: Matches numbers written in digits with words in parentheses
 * Example: "$1,250,000 (One Million Two Hundred Thousand Dollars)"
 */
export function verifyDualNumberAndWordExpressions(documentText: string): {
  issues: QAIssue[];
  dualPairs: DualExpressionPair[];
} {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  // Regex pattern matching "$1,250,000 (One Million Two Hundred Thousand Dollars)" or "50 (fifty) days"
  const dualRegex = /([$€£¥₹]?\s*\d+(?:,\d{3})*(?:\.\d+)?)\s*\(\s*([a-zA-Z\s-]+?)(?:\s*(?:dollars|rupees|cents|days|months|hours|percent|only))?\s*\)/gi;

  let match: RegExpExecArray | null;
  const pairs: DualExpressionPair[] = [];

  while ((match = dualRegex.exec(documentText)) !== null) {
    const rawFull = match[0];
    const numPart = match[1];
    const wordPart = match[2];

    const numericVal = parseFloat(numPart.replace(/[$€£¥₹,\s]/g, ''));
    const wordsVal = wordsToNumber(wordPart);

    if (numericVal !== null && wordsVal !== null && !isNaN(numericVal)) {
      const isMatch = Math.abs(numericVal - wordsVal) < 0.01;
      const lineNum = getLineNumber(documentText, match.index);

      pairs.push({
        numericStr: numPart.trim(),
        numericVal,
        wordsStr: wordPart.trim(),
        wordsVal,
        isMatch,
        difference: numericVal - wordsVal,
        rawText: rawFull,
        lineNumber: lineNum,
      });

      if (!isMatch) {
        issues.push({
          id: `dual-expr-mismatch-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: 'Dual Representation Mismatch (Digits vs Words)',
          description: `Numeric figure ${numPart.trim()} (${numericVal.toLocaleString()}) contradicts the written words "${wordPart.trim()}" (${wordsVal.toLocaleString()}). Discrepancy: ${Math.abs(numericVal - wordsVal).toLocaleString()}.`,
          originalText: rawFull,
          suggestedText: `${numPart.trim()} [VERIFY: words state ${wordsVal.toLocaleString()}]`,
          startOffset: match.index,
          endOffset: match.index + rawFull.length,
          lineNumber: lineNum,
          ruleId: 'dual-number-words-consistency',
          autoApplicable: false,
          explanation: `In legal contracts and technical reports, when an amount is expressed in both digits and written words, both expressions must agree precisely. Currently, digits show ${numericVal} while words evaluate to ${wordsVal}.`,
        });
      }
    }
  }

  return { issues, dualPairs: pairs };
}
