import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

export function checkUniformityAndPlaceholders(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  // 1. Placeholder & Draft Leakage Detection
  const placeholderRegex = /(\[TODO[^\]]*\]|\[TBD[^\]]*\]|\[INSERT[^\]]*\]|\[REVISE[^\]]*\]|\[ADD\s+[^\]]*\]|\[DRAFT[^\]]*\]|\[CONFIRM[^\]]*\]|\bXXXX\b|\bLorem\s+ipsum\b|__+\b)/gi;
  let phMatch: RegExpExecArray | null;
  while ((phMatch = placeholderRegex.exec(text)) !== null) {
    const orig = phMatch[0];
    issues.push({
      id: `u-ph-${idCounter++}`,
      category: 'placeholder',
      severity: 'critical',
      title: 'Unresolved Draft Placeholder',
      description: `Found draft placeholder "${orig}". Must be finalized before report publication.`,
      originalText: orig,
      suggestedText: '',
      startOffset: phMatch.index,
      endOffset: phMatch.index + orig.length,
      lineNumber: getLineNumber(text, phMatch.index),
      ruleId: 'draft-placeholder',
      autoApplicable: false,
      explanation: 'Reports circulated to clients, auditors, or executives must be purged of all temporary scaffolding text.',
    });
  }

  // 2. Currency Representation Uniformity
  // Detect if document mixes symbol ($) with code (USD)
  const dollarSymbolCount = (text.match(/\$\d+/g) || []).length;
  const usdCodeCount = (text.match(/\bUSD\s*\d+|\b\d+\s*USD\b/g) || []).length;
  const euroSymbolCount = (text.match(/€\d+/g) || []).length;
  const eurCodeCount = (text.match(/\bEUR\s*\d+|\b\d+\s*EUR\b/g) || []).length;

  if (dollarSymbolCount > 0 && usdCodeCount > 0) {
    // Flag inconsistent usage
    const primaryIsSymbol = dollarSymbolCount >= usdCodeCount;
    const searchRegex = primaryIsSymbol ? /\bUSD\s*(\d+(?:\.\d+)?)\b/g : /\$(\d+(?:\.\d+)?)\b/g;
    let currMatch: RegExpExecArray | null;
    while ((currMatch = searchRegex.exec(text)) !== null) {
      const orig = currMatch[0];
      const fix = primaryIsSymbol ? `$${currMatch[1]}` : `${currMatch[1]} USD`;
      issues.push({
        id: `u-curr-${idCounter++}`,
        category: 'uniformity',
        severity: 'warning',
        title: 'Inconsistent Currency Notation',
        description: primaryIsSymbol 
          ? `Document predominantly uses symbol ($), but found "${orig}". Standardize to "$${currMatch[1]}".` 
          : `Document predominantly uses ISO code (USD), but found "${orig}". Standardize to "${currMatch[1]} USD".`,
        originalText: orig,
        suggestedText: fix,
        startOffset: currMatch.index,
        endOffset: currMatch.index + orig.length,
        lineNumber: getLineNumber(text, currMatch.index),
        ruleId: 'currency-uniformity',
        autoApplicable: true,
        explanation: 'Maintaining identical notation ($ vs USD) throughout a single financial section builds institutional confidence.',
      });
    }
  }

  // 3. Thousands Separator Uniformity (e.g. 10,000 vs 10000 for 5+ digit numbers)
  const numbersWithCommas = (text.match(/\b\d{1,3},\d{3}(?:,\d{3})*(?:\.\d+)?\b/g) || []).length;
  const numbersWithoutCommas = (text.match(/\b\d{5,}(?:\.\d+)?\b/g) || []).length;

  if (numbersWithCommas >= 2 && numbersWithoutCommas >= 1) {
    // Majority uses commas
    const noCommaRegex = /\b(\d{2,3})(\d{3})\b/g;
    let numMatch: RegExpExecArray | null;
    while ((numMatch = noCommaRegex.exec(text)) !== null) {
      const orig = numMatch[0];
      // Don't format years like 2024 or 1999
      const val = parseInt(orig, 10);
      if (val >= 10000) {
        const fix = `${numMatch[1]},${numMatch[2]}`;
        issues.push({
          id: `u-num-${idCounter++}`,
          category: 'uniformity',
          severity: 'suggestion',
          title: 'Thousands Separator Uniformity',
          description: `Most large figures use comma separators. Format "${orig}" as "${fix}".`,
          originalText: orig,
          suggestedText: fix,
          startOffset: numMatch.index,
          endOffset: numMatch.index + orig.length,
          lineNumber: getLineNumber(text, numMatch.index),
          ruleId: 'number-format-uniformity',
          autoApplicable: true,
        });
      }
    }
  }

  // 4. Bullet Point Terminal Punctuation Uniformity
  // Check lists of bullet points (starting with - or * or •)
  const lines = text.split('\n');
  const bulletIndices: number[] = [];
  const bulletEndsWithPeriod: boolean[] = [];

  let currentOffset = 0;
  const lineOffsets: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(currentOffset);
    const line = lines[i].trim();
    if (/^[-*•]\s+/.test(line)) {
      bulletIndices.push(i);
      bulletEndsWithPeriod.push(/[.!?]$/.test(line));
    }
    currentOffset += lines[i].length + 1; // +1 for newline
  }

  if (bulletIndices.length >= 3) {
    const periodCount = bulletEndsWithPeriod.filter(Boolean).length;
    const noPeriodCount = bulletEndsWithPeriod.length - periodCount;

    // Inconsistency threshold
    if (periodCount > 0 && noPeriodCount > 0) {
      const majorityHasPeriod = periodCount >= noPeriodCount;
      bulletIndices.forEach((lineIdx, i) => {
        const hasPeriod = bulletEndsWithPeriod[i];
        if (hasPeriod !== majorityHasPeriod) {
          const rawLine = lines[lineIdx];
          const offset = lineOffsets[lineIdx];
          const trimmed = rawLine.trim();
          const fix = majorityHasPeriod ? `${trimmed}.` : trimmed.replace(/[.]$/, '');

          issues.push({
            id: `u-blt-${idCounter++}`,
            category: 'uniformity',
            severity: 'suggestion',
            title: 'Inconsistent Bullet Punctuation',
            description: majorityHasPeriod 
              ? 'Most list items end with a period. Add terminal period to this item for uniformity.'
              : 'Most list items do not end with a period. Remove terminal period for uniformity.',
            originalText: trimmed,
            suggestedText: fix,
            startOffset: offset + (rawLine.indexOf(trimmed)),
            endOffset: offset + (rawLine.indexOf(trimmed)) + trimmed.length,
            lineNumber: lineIdx + 1,
            ruleId: 'bullet-punctuation-uniformity',
            autoApplicable: true,
          });
        }
      });
    }
  }

  // 5. Date Format Uniformity
  // Detect mixing ISO (2024-05-12) vs Written (May 12, 2024)
  const isoDates = (text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []).length;
  const writtenDates = (text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/g) || []).length;
  const slashDates = (text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || []).length;

  const dateStylesCount = (isoDates > 0 ? 1 : 0) + (writtenDates > 0 ? 1 : 0) + (slashDates > 0 ? 1 : 0);
  if (dateStylesCount >= 2) {
    issues.push({
      id: `u-date-style-${idCounter++}`,
      category: 'uniformity',
      severity: 'warning',
      title: 'Mixed Date Conventions',
      description: `Report mixes different date formatting styles (${isoDates > 0 ? 'ISO 2024-MM-DD, ' : ''}${writtenDates > 0 ? 'Written "Month DD, YYYY", ' : ''}${slashDates > 0 ? 'Slash MM/DD/YYYY' : ''}). Choose one standard across all sections.`,
      originalText: '',
      suggestedText: '',
      startOffset: 0,
      endOffset: 0,
      lineNumber: 1,
      ruleId: 'date-format-uniformity',
      autoApplicable: false,
      explanation: 'Consistent date formats avoid cross-jurisdiction confusion (e.g., whether 06/07 is June 7th or July 6th).',
    });
  }

  // 6. Header / Footer & Pagination Synchronicity
  // A. Hardcoded Page Numbering in Document Body/Footnotes
  const hardcodedPageRegex = /\b(?:page\s*[-–:]?\s*\d+\s*(?:of|\/)\s*\d+|p\.\s*\d+\s*(?:of|\/)\s*\d+)\b/gi;
  let pageMatch: RegExpExecArray | null;
  while ((pageMatch = hardcodedPageRegex.exec(text)) !== null) {
    issues.push({
      id: `u-page-hardcoded-${idCounter++}`,
      category: 'uniformity',
      severity: 'warning',
      title: `Hardcoded Pagination Detected ("${pageMatch[0]}")`,
      description: `Found hardcoded page numbering "${pageMatch[0]}" on line ${getLineNumber(text, pageMatch.index)}. Hardcoded page numbers become out-of-sync when content expands, shifts margins, or exports to Word/PDF. Use dynamic running footers instead.`,
      originalText: pageMatch[0],
      suggestedText: '',
      startOffset: pageMatch.index,
      endOffset: pageMatch.index + pageMatch[0].length,
      lineNumber: getLineNumber(text, pageMatch.index),
      ruleId: 'hardcoded-pagination-desync',
      autoApplicable: false,
      explanation: 'Export engines inject dynamic Microsoft Word and PDF page fields ({PAGE} of {NUMPAGES}) in the running footer. Hardcoded page numbers in body text produce conflicting pagination.',
    });
  }

  // B. Heading Hierarchy Structural Alignment (e.g. # followed directly by ### skipping ##)
  const headingMatches = [...text.matchAll(/^(#{1,6})\s+([^\n\r]+)/gm)];
  for (let i = 0; i < headingMatches.length - 1; i++) {
    const currentLevel = headingMatches[i][1].length;
    const nextLevel = headingMatches[i + 1][1].length;
    if (nextLevel > currentLevel + 1) {
      const skippedLevel = currentLevel + 1;
      const targetMatch = headingMatches[i + 1];
      const matchIdx = targetMatch.index ?? 0;
      issues.push({
        id: `u-heading-skip-${idCounter++}`,
        category: 'uniformity',
        severity: 'suggestion',
        title: `Skipped Heading Hierarchy Level (Jumped from H${currentLevel} to H${nextLevel})`,
        description: `Heading "${targetMatch[2]}" jumps from level H${currentLevel} directly to H${nextLevel}, skipping H${skippedLevel}. Standardize heading hierarchy for structured Word document outlines.`,
        originalText: targetMatch[0],
        suggestedText: `${'#'.repeat(skippedLevel)} ${targetMatch[2]}`,
        startOffset: matchIdx,
        endOffset: matchIdx + targetMatch[0].length,
        lineNumber: getLineNumber(text, matchIdx),
        ruleId: 'heading-hierarchy-skip',
        autoApplicable: true,
        explanation: 'Consistent heading nesting ensures accurate Table of Contents generation and navigation in exported Word and PDF files.',
      });
    }
  }

  return issues;
}

/**
 * Directs and adjusts document formatting:
 * - Strips trailing line whitespaces
 * - Collapses excessive blank lines (>2 into 2)
 * - Formats and aligns Markdown tables so columns and delimiters line up vertically
 * - Standardizes list bullet spacing
 */
export function autoFormatDocumentText(text: string): string {
  const lines = text.split('\n');
  const formattedLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if start of a Markdown table: line contains | and next line is delimiter |---|
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
      const tableBlock: string[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
        tableBlock.push(lines[i]);
        i++;
      }
      formattedLines.push(formatMarkdownTable(tableBlock));
      continue;
    }

    // Standard line formatting: remove trailing whitespace
    formattedLines.push(line.replace(/\s+$/, ''));
    i++;
  }

  // Collapse 3+ consecutive empty lines into 2
  return formattedLines.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

function formatMarkdownTable(rawLines: string[]): string {
  if (rawLines.length < 2) return rawLines.join('\n');

  // Parse rows and cells
  const rows = rawLines.map(row => 
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim())
  );

  const colCount = Math.max(...rows.map(r => r.length));
  if (colCount === 0) return rawLines.join('\n');

  // Find max length for each column
  const colWidths = new Array(colCount).fill(3);
  rows.forEach((row, rowIdx) => {
    if (rowIdx === 1) return; // delimiter row
    row.forEach((cell, cIdx) => {
      colWidths[cIdx] = Math.max(colWidths[cIdx], cell.length);
    });
  });

  const formattedRows: string[] = [];
  rows.forEach((row, rowIdx) => {
    if (rowIdx === 1) {
      // Delimiter row
      const delims = colWidths.map(w => '-'.repeat(Math.max(w, 3)));
      formattedRows.push(`| ${delims.join(' | ')} |`);
    } else {
      const cells = colWidths.map((w, cIdx) => {
        const val = row[cIdx] || '';
        // Right-align numeric/currency cells, left-align text
        const isNumeric = /^[$€£¥]?\s*-?\d+(?:,\d{3})*(?:\.\d+)?%?$/.test(val);
        return isNumeric ? val.padStart(w, ' ') : val.padEnd(w, ' ');
      });
      formattedRows.push(`| ${cells.join(' | ')} |`);
    }
  });

  return formattedRows.join('\n');
}

