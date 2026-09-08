import { QAIssue, DataContinuityStats } from '../types';
import { getLineNumber } from './grammarRules';

export function checkDataContinuity(text: string): { issues: QAIssue[]; stats: DataContinuityStats } {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  const stats: DataContinuityStats = {
    numbersChecked: 0,
    inconsistenciesDetected: 0,
    currenciesFound: [],
    unitsFound: [],
    datesFound: [],
    tablesReferenced: [],
    tablesDefined: [],
    repeatedMetricsChecked: 0,
    conflictingMetricsFound: 0,
    staleCopiedDataFound: 0,
    unchangedDefaultsFound: 0,
  };

  // 1. Percentage Breakdown Sum Validation
  // Safely scans sentences with breakdown keywords to prevent regex backtracking
  const sentenceRegex = /([^\r\n.?!]+[.?!])/g;
  let sentMatch: RegExpExecArray | null;
  while ((sentMatch = sentenceRegex.exec(text)) !== null) {
    const sentence = sentMatch[0];
    if (!/(?:breakdown|comprise|composed of|consist of|accounted for|share of|split|distribution)/i.test(sentence)) {
      continue;
    }
    const sentenceOffset = sentMatch.index;
    const pcts = [...sentence.matchAll(/(\d+(?:\.\d+)?)%/g)].map(m => parseFloat(m[1]));
    
    if (pcts.length >= 2) {
      stats.numbersChecked += pcts.length;
      const sum = pcts.reduce((acc, val) => acc + val, 0);
      // If the sentence sounds like an exhaustive breakdown and sum != 100
      if (Math.abs(sum - 100) > 0.1 && (sum > 100 || sum < 99)) {
        stats.inconsistenciesDetected++;
        issues.push({
          id: `dc-pct-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: 'Percentage Distribution Mismatch',
          description: `The percentages in this breakdown sum to ${sum.toFixed(1)}%, which deviates from the expected 100% total (${pcts.join('% + ')}%).`,
          originalText: sentence.trim(),
          suggestedText: `${sentence.trim()} [VERIFY SUM: currently ${sum.toFixed(1)}%]`,
          startOffset: sentenceOffset,
          endOffset: sentenceOffset + sentence.length,
          lineNumber: getLineNumber(text, sentenceOffset),
          ruleId: 'percentage-breakdown-sum',
          autoApplicable: false,
          explanation: `When presenting an exhaustive categorical breakdown (comprising, distribution, split), the individual segments must logically sum to exactly 100%. Current sum is ${sum.toFixed(1)}%.`,
        });
      }
    }
  }

  // 2. Directional Contradiction (e.g. "increased from 100 to 80" or "decreased from 50 to 90")
  const directionRegex = /\b(increased|rose|climbed|grown|jumped|decreased|dropped|fell|declined)\s+(?:by\s+[^,\n.]+?\s+)?from\s+([$€£¥]?\d+(?:\.\d+)?)\s*(?:M|B|k|%)?\s+to\s+([$€£¥]?\d+(?:\.\d+)?)\s*(?:M|B|k|%)?\b/gi;
  let dirMatch: RegExpExecArray | null;
  while ((dirMatch = directionRegex.exec(text)) !== null) {
    const [fullMatch, verb, rawStart, rawEnd] = dirMatch;
    const startVal = parseFloat(rawStart.replace(/[$€£¥]/g, ''));
    const endVal = parseFloat(rawEnd.replace(/[$€£¥]/g, ''));
    
    stats.numbersChecked += 2;
    const isUpVerb = ['increased', 'rose', 'climbed', 'grown', 'jumped'].includes(verb.toLowerCase());
    const isDownVerb = ['decreased', 'dropped', 'fell', 'declined'].includes(verb.toLowerCase());

    if (!isNaN(startVal) && !isNaN(endVal)) {
      if (isUpVerb && endVal < startVal) {
        stats.inconsistenciesDetected++;
        const fixedVerb = verb.toLowerCase() === 'rose' ? 'fell' : 'decreased';
        const corrected = fullMatch.replace(new RegExp(`\\b${verb}\\b`, 'i'), fixedVerb);
        issues.push({
          id: `dc-dir-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: 'Directional Numerical Contradiction',
          description: `Stated that values "${verb}" from ${rawStart} to ${rawEnd}, but ${rawEnd} is lower than ${rawStart}.`,
          originalText: fullMatch,
          suggestedText: corrected,
          startOffset: dirMatch.index,
          endOffset: dirMatch.index + fullMatch.length,
          lineNumber: getLineNumber(text, dirMatch.index),
          ruleId: 'directional-contradiction',
          autoApplicable: true,
          explanation: `A metric moving from ${rawStart} down to ${rawEnd} represents a decrease, not an increase.`,
        });
      } else if (isDownVerb && endVal > startVal) {
        stats.inconsistenciesDetected++;
        const fixedVerb = verb.toLowerCase() === 'fell' ? 'rose' : 'increased';
        const corrected = fullMatch.replace(new RegExp(`\\b${verb}\\b`, 'i'), fixedVerb);
        issues.push({
          id: `dc-dir-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: 'Directional Numerical Contradiction',
          description: `Stated that values "${verb}" from ${rawStart} to ${rawEnd}, but ${rawEnd} is higher than ${rawStart}.`,
          originalText: fullMatch,
          suggestedText: corrected,
          startOffset: dirMatch.index,
          endOffset: dirMatch.index + fullMatch.length,
          lineNumber: getLineNumber(text, dirMatch.index),
          ruleId: 'directional-contradiction',
          autoApplicable: true,
          explanation: `A metric moving from ${rawStart} up to ${rawEnd} represents an increase, not a decrease.`,
        });
      }
    }
  }

  // 3. Stated Total vs Additive Components check
  // e.g. "Total of $100M ($40M ... and $45M)"
  const sumCheckRegex = /\b(?:total|sum|combined)\s+(?:of\s+)?([$€£¥]?\d+(?:\.\d+)?)\s*(M|B|k|%)?\s*\(([^)]+)\)/gi;
  let sumMatch: RegExpExecArray | null;
  while ((sumMatch = sumCheckRegex.exec(text)) !== null) {
    const full = sumMatch[0];
    const statedTotal = parseFloat(sumMatch[1].replace(/[$€£¥]/g, ''));
    const parenthetical = sumMatch[3];
    
    // Find all numbers inside the parenthetical
    const innerNumbers = [...parenthetical.matchAll(/[$€£¥]?(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
    if (innerNumbers.length >= 2) {
      stats.numbersChecked += innerNumbers.length + 1;
      const componentSum = innerNumbers.reduce((a, b) => a + b, 0);
      const diff = Math.abs(componentSum - statedTotal);
      if (diff > 0.05 && diff / (statedTotal || 1) > 0.02) {
        stats.inconsistenciesDetected++;
        issues.push({
          id: `dc-sum-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: 'Component Sum vs Stated Total Discrepancy',
          description: `Stated total is ${statedTotal}, but the listed components (${innerNumbers.join(' + ')}) sum to ${componentSum.toFixed(1)} (variance of ${diff.toFixed(1)}).`,
          originalText: full,
          suggestedText: full.replace(new RegExp(`\\b${statedTotal}\\b`), componentSum.toString()),
          startOffset: sumMatch.index,
          endOffset: sumMatch.index + full.length,
          lineNumber: getLineNumber(text, sumMatch.index),
          ruleId: 'component-sum-mismatch',
          autoApplicable: false,
          explanation: `Check whether one of the listed sub-components is misstated or if the aggregate figure requires updating.`,
        });
      }
    }
  }

  // 4. Chronological Inversions (e.g., "From 2026 to 2021" or "between 2025 and 2023")
  const yearInversionRegex = /\b(?:from|between)\s+(\d{4})\s+(?:to|and)\s+(\d{4})\b/gi;
  let yrMatch: RegExpExecArray | null;
  while ((yrMatch = yearInversionRegex.exec(text)) !== null) {
    const y1 = parseInt(yrMatch[1], 10);
    const y2 = parseInt(yrMatch[2], 10);
    if (y1 >= 1970 && y1 <= 2050 && y2 >= 1970 && y2 <= 2050) {
      if (y1 > y2) {
        stats.inconsistenciesDetected++;
        const corrected = yrMatch[0].replace(yrMatch[1], yrMatch[2]).replace(yrMatch[2], yrMatch[1]);
        issues.push({
          id: `dc-yr-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: 'Chronological Inversion',
          description: `Start year (${y1}) is after end year (${y2}). Time periods should follow chronological sequence.`,
          originalText: yrMatch[0],
          suggestedText: corrected,
          startOffset: yrMatch.index,
          endOffset: yrMatch.index + yrMatch[0].length,
          lineNumber: getLineNumber(text, yrMatch.index),
          ruleId: 'chronological-order',
          autoApplicable: true,
          explanation: `Historical and projection timelines must proceed forward chronologically unless explicitly describing reverse order.`,
        });
      }
    }
  }

  // 5. Cross-Reference Validation: "Table X", "Figure Y"
  // Find all defined tables/figures
  const definedTableRegex = /\b(Table|Figure|Exhibit|Appendix)\s+(\d+|[A-Z])(?:\s*:|\s*[-–]|\s*\n)/gi;
  let defMatch: RegExpExecArray | null;
  const definedRefs = new Set<string>();
  while ((defMatch = definedTableRegex.exec(text)) !== null) {
    const refKey = `${defMatch[1].toLowerCase()} ${defMatch[2].toLowerCase()}`;
    definedRefs.add(refKey);
    stats.tablesDefined.push(`${defMatch[1]} ${defMatch[2]}`);
  }

  // Find all cited references like "as seen in Table 2", "refer to Figure 3"
  const citedRefRegex = /\b(?:in|see|refer to|illustrated in|shown in|per)\s+(Table|Figure|Exhibit|Appendix)\s+(\d+|[A-Z])\b/gi;
  let citeMatch: RegExpExecArray | null;
  while ((citeMatch = citedRefRegex.exec(text)) !== null) {
    const refType = citeMatch[1];
    const refNum = citeMatch[2];
    const refKey = `${refType.toLowerCase()} ${refNum.toLowerCase()}`;
    stats.tablesReferenced.push(`${refType} ${refNum}`);

    // If document has defined at least one Table/Figure but NOT this specific cited one:
    if (definedRefs.size > 0 && !definedRefs.has(refKey)) {
      stats.inconsistenciesDetected++;
      issues.push({
        id: `dc-ref-${idCounter++}`,
        category: 'data-continuity',
        severity: 'warning',
        title: `Unresolved Reference (${refType} ${refNum})`,
        description: `The document references "${refType} ${refNum}", but no caption or definition for "${refType} ${refNum}" exists in the text.`,
        originalText: citeMatch[0],
        suggestedText: citeMatch[0],
        startOffset: citeMatch.index,
        endOffset: citeMatch.index + citeMatch[0].length,
        lineNumber: getLineNumber(text, citeMatch.index),
        ruleId: 'broken-cross-reference',
        autoApplicable: false,
        explanation: `Reports should not contain dangling references to non-existent figures or tables. Existing items defined: ${Array.from(definedRefs).join(', ')}.`,
      });
    }
  }

  return { issues, stats };
}
