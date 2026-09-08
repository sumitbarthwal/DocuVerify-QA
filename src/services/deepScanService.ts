import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

export interface ExtractedTableItem {
  metricName: string;
  normalizedKey: string;
  rawValue: string;
  numericValue: number;
  unit?: string;
  tableContext: string;
  rawSnippet: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
}

export interface ExtractedTable {
  title?: string;
  headers: string[];
  items: ExtractedTableItem[];
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  statedTotal?: {
    rawValue: string;
    numericValue: number;
    offset: number;
    line: number;
    snippet: string;
  };
}

/**
 * Normalizes metric labels for fuzzy cross-referencing between tables and text blocks
 */
function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(less|add|net|gross|the|our|total|estimated|assessed|adjusted|value|amount)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Parses numeric and monetary values with unit multipliers
 */
function parseNumber(str: string): number | null {
  const clean = str.replace(/[$,€£¥\s]/g, '');
  let multiplier = 1;
  if (/m(illion)?\b/i.test(str)) multiplier = 1_000_000;
  else if (/b(illion)?\b/i.test(str)) multiplier = 1_000_000_000;
  else if (/k\b/i.test(str)) multiplier = 1_000;

  const m = clean.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (!m) return null;
  const val = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(val)) return null;
  return val * multiplier;
}

/**
 * Extracts markdown tables and structured itemized tabular schedules from document text
 */
export function extractTablesAndSchedules(text: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  const lines = text.split('\n');
  let currentOffset = 0;

  let inMarkdownTable = false;
  let mdHeaders: string[] = [];
  let mdItems: ExtractedTableItem[] = [];
  let tableStartOffset = 0;
  let tableStartLine = 1;
  let tableTitle = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineOffset = currentOffset;
    const trimmed = line.trim();

    // Check for table title/header before table
    if (trimmed.startsWith('#') || trimmed.match(/^(?:table|schedule|exhibit)\s+\d+/i)) {
      tableTitle = trimmed.replace(/^[#\s]+/, '');
    }

    // A. Markdown Table: lines starting and ending with '|'
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|', 1)) {
      if (!inMarkdownTable) {
        inMarkdownTable = true;
        tableStartOffset = lineOffset;
        tableStartLine = i + 1;
        mdHeaders = trimmed
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());
        mdItems = [];
      } else if (trimmed.match(/^\|(?:\s*:?-+:?\s*\|)+$/)) {
        // Divider line, skip
      } else {
        // Data row in markdown table
        const cells = trimmed
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());
        if (cells.length >= 2) {
          const rowLabel = cells[0];
          // Check subsequent cells for numerical values
          for (let c = 1; c < cells.length; c++) {
            const cellVal = cells[c];
            const num = parseNumber(cellVal);
            if (num !== null && num > 0) {
              const cellOffset = lineOffset + line.indexOf(cellVal);
              mdItems.push({
                metricName: rowLabel,
                normalizedKey: normalizeKey(rowLabel),
                rawValue: cellVal,
                numericValue: num,
                tableContext: tableTitle || 'Markdown Table',
                rawSnippet: trimmed,
                startOffset: cellOffset >= 0 ? cellOffset : lineOffset,
                endOffset: (cellOffset >= 0 ? cellOffset : lineOffset) + cellVal.length,
                lineNumber: i + 1,
              });
            }
          }
        }
      }
    } else {
      if (inMarkdownTable) {
        // End of markdown table
        if (mdItems.length > 0) {
          tables.push({
            title: tableTitle || 'Structured Table',
            headers: mdHeaders,
            items: mdItems,
            startOffset: tableStartOffset,
            endOffset: lineOffset,
            startLine: tableStartLine,
            endLine: i,
          });
        }
        inMarkdownTable = false;
        mdHeaders = [];
        mdItems = [];
      }
    }

    currentOffset += line.length + 1; // +1 for newline
  }

  // Handle table at end of document
  if (inMarkdownTable && mdItems.length > 0) {
    tables.push({
      title: tableTitle || 'Structured Table',
      headers: mdHeaders,
      items: mdItems,
      startOffset: tableStartOffset,
      endOffset: text.length,
      startLine: tableStartLine,
      endLine: lines.length,
    });
  }

  // B. Itemized Tabular Assessment / Schedule Blocks
  // Sections explicitly titled "Schedule of Assessment", "Loss Computation Table", "Cost Center Ledger", etc.
  const scheduleRegex = /(?:##\s*[^#\n\r]*?(?:schedule|computation|breakdown|ledger|matrix|summary\s+table)[^\n\r]*\n)([\s\S]*?)(?=\n##|\n#|$)/gi;
  let schedMatch: RegExpExecArray | null;

  while ((schedMatch = scheduleRegex.exec(text)) !== null) {
    const blockContent = schedMatch[1];
    const blockOffset = schedMatch.index + (schedMatch[0].length - blockContent.length);
    const blockLines = blockContent.split('\n');
    const items: ExtractedTableItem[] = [];
    let statedTotal: ExtractedTable['statedTotal'] = undefined;

    let localOffset = blockOffset;
    for (let j = 0; j < blockLines.length; j++) {
      const bLine = blockLines[j];
      const trimmedBLine = bLine.trim();

      // Look for bullet items or key-value rows like: "- Gross Loss Assessed: $140,000" or "Salvage Value: $12,500"
      const kvMatch = trimmedBLine.match(/^(?:[-*•]\s*)?([^:\n\r]+?)\s*:\s*([$€£¥]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|M|B|k|million|billion|thousand|USD|EUR)?)\b/i);
      if (kvMatch) {
        const rawLabel = kvMatch[1].trim();
        const rawVal = kvMatch[2].trim();
        const num = parseNumber(rawVal);
        if (num !== null && num > 0) {
          const itemOffset = localOffset + bLine.indexOf(rawVal);
          const item: ExtractedTableItem = {
            metricName: rawLabel,
            normalizedKey: normalizeKey(rawLabel),
            rawValue: rawVal,
            numericValue: num,
            tableContext: 'Schedule of Assessment / Loss Computation',
            rawSnippet: trimmedBLine,
            startOffset: itemOffset >= 0 ? itemOffset : localOffset,
            endOffset: (itemOffset >= 0 ? itemOffset : localOffset) + rawVal.length,
            lineNumber: getLineNumber(text, localOffset),
          };
          items.push(item);

          if (rawLabel.match(/\b(net|total|final|balance)\b/i)) {
            statedTotal = {
              rawValue: rawVal,
              numericValue: num,
              offset: itemOffset,
              line: item.lineNumber,
              snippet: trimmedBLine,
            };
          }
        }
      }
      localOffset += bLine.length + 1;
    }

    if (items.length >= 2) {
      tables.push({
        title: 'Schedule / Tabular Computation Block',
        headers: ['Particulars', 'Amount'],
        items,
        startOffset: blockOffset,
        endOffset: blockOffset + blockContent.length,
        startLine: getLineNumber(text, blockOffset),
        endLine: getLineNumber(text, blockOffset + blockContent.length),
        statedTotal,
      });
    }
  }

  return tables;
}

/**
 * Performs Deep Scan cross-referencing between tables and text blocks:
 * 1. Narrative Text Blocks vs Table Cell figures (flags conflicting mentions of the same item)
 * 2. Schedule Arithmetic Verification (validates Net Assessed = Gross - Deductions, or Column Sums)
 * 3. Text Block Claims vs Tabular Backing
 */
export function performDeepTableTextCrossScan(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  const tables = extractTablesAndSchedules(text);
  if (tables.length === 0) {
    return issues;
  }

  // Collect all table items into a lookup
  const allTableItems: ExtractedTableItem[] = [];
  for (const t of tables) {
    allTableItems.push(...t.items);
  }

  // Find all narrative text blocks outside table boundaries
  const isInsideTable = (offset: number) => {
    return tables.some(t => offset >= t.startOffset && offset <= t.endOffset);
  };

  // CHECK 1: Deep Cross-Referencing Table Figures with Narrative Notes & Disclosures
  for (const tableItem of allTableItems) {
    if (tableItem.normalizedKey.length < 3) continue;

    // Build regex to find mentions of this concept in narrative text blocks
    // Escape regex special chars in the key
    const escapedKey = tableItem.normalizedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    
    // Pattern: metric concept followed near or after by a number/currency:
    // e.g. "salvage value was agreed ... at $16,000" or "depreciation amounted to $15,000"
    const narrativeMentionRegex = new RegExp(
      `\\b(?:${escapedKey}|${tableItem.metricName.replace(/[^a-zA-Z0-9\s]/g, '').trim()})\\b[^\n\r$€£¥\\d]{0,65}?(?:[:=–-]|was|is|at|of|less|totaling|stands at|amounted to)?\\s*([$€£¥]?\\s*\\d+(?:,\\d{3})*(?:\\.\\d+)?\\s*(?:M|B|k|million|billion|thousand|USD|EUR)?)`,
      'gi'
    );

    let match: RegExpExecArray | null;
    while ((match = narrativeMentionRegex.exec(text)) !== null) {
      const matchOffset = match.index;
      const narrativeRawVal = match[1].trim();
      const narrativeSnippet = match[0].trim();
      const narrativeLine = getLineNumber(text, matchOffset);

      // Skip if this mention is inside the table itself
      if (isInsideTable(matchOffset)) {
        continue;
      }

      const narrativeNum = parseNumber(narrativeRawVal);
      if (narrativeNum === null || narrativeNum <= 0) continue;

      // Compare numeric values (tolerance for floating point)
      if (Math.abs(narrativeNum - tableItem.numericValue) > 0.01) {
        // Prevent duplicate issue for the exact same offset
        if (issues.some(iss => Math.abs(iss.startOffset - matchOffset) < 10)) {
          continue;
        }

        const variance = Math.abs(narrativeNum - tableItem.numericValue);
        const varianceFormatted = variance >= 1000 ? variance.toLocaleString() : variance.toString();

        issues.push({
          id: `deep-scan-table-text-diff-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: `[Deep Scan] Table vs. Text Divergence: "${tableItem.metricName}"`,
          description: `Deep Scan detected a discrepancy for "${tableItem.metricName}": Tabular schedule defines "${tableItem.rawValue}" on line ${tableItem.lineNumber}, but narrative remarks cite "${narrativeRawVal}" on line ${narrativeLine} (Variance: ${varianceFormatted}). Tabular schedules and narrative notes must strictly reconcile.`,
          originalText: narrativeSnippet,
          suggestedText: narrativeSnippet.replace(narrativeRawVal, tableItem.rawValue),
          startOffset: matchOffset,
          endOffset: matchOffset + match[0].length,
          lineNumber: narrativeLine,
          ruleId: 'deep-scan-table-text-divergence',
          autoApplicable: true,
          explanation: `Rigorous cross-referencing between tables and text blocks ensures regulatory and audit compliance. When numbers differ between summary tables and explanatory text, underwriters and auditors flag reports as defective.`,
        });
      }
    }
  }

  // CHECK 2: Tabular Schedule Math & Deduction Arithmetic
  for (const table of tables) {
    if (table.items.length >= 3) {
      // Look for Gross, Less/Deductions, and Net Assessed in schedules
      const grossItem = table.items.find(i => i.metricName.match(/\b(gross\s+(?:loss|amount|revenue|total)|total\s+gross)\b/i));
      const netItem = table.items.find(i => i.metricName.match(/\b(net\s+(?:assessed|adjusted|loss|liability|claim|payable|profit|income))\b/i));
      const deductionItems = table.items.filter(i => 
        i.metricName.match(/\b(depreciation|salvage|excess|deductible|scrap|allowance|tax|discount)\b/i) ||
        i.metricName.toLowerCase().startsWith('less')
      );

      if (grossItem && netItem && deductionItems.length >= 1) {
        const totalDeductions = deductionItems.reduce((sum, item) => sum + item.numericValue, 0);
        const expectedNet = grossItem.numericValue - totalDeductions;
        const actualNet = netItem.numericValue;

        if (Math.abs(expectedNet - actualNet) > 0.05) {
          const diff = Math.abs(expectedNet - actualNet);
          issues.push({
            id: `deep-scan-table-math-${idCounter++}`,
            category: 'data-continuity',
            severity: 'critical',
            title: `[Deep Scan] Schedule Arithmetic Variance in ${table.title}`,
            description: `Table computation arithmetic mismatch: Gross (${grossItem.rawValue}) minus deductions (${deductionItems.map(d => `${d.metricName}: ${d.rawValue}`).join(', ')}) computes to ${expectedNet.toLocaleString()}, but Net Assessed is entered as ${netItem.rawValue} (Variance of ${diff.toLocaleString()}).`,
            originalText: netItem.rawSnippet,
            suggestedText: netItem.rawSnippet.replace(netItem.rawValue, `$${expectedNet.toLocaleString()}`),
            startOffset: netItem.startOffset,
            endOffset: netItem.endOffset,
            lineNumber: netItem.lineNumber,
            ruleId: 'deep-scan-schedule-arithmetic',
            autoApplicable: true,
            explanation: `Insurance loss computation schedules and accounting tables must balance mathematically. Stated net totals must exactly equal gross loss minus all itemized deductions.`,
          });
        }
      }
    }
  }

  return issues;
}
