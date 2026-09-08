import { QAIssue, ExtractedMetric, MetricOccurrence, RuleConfig } from '../types';
import { getLineNumber } from './grammarRules';

/**
 * Normalizes metric names for cross-document clustering
 * (e.g., "Total Gross Bookings" and "Gross bookings" -> "gross bookings")
 */
function normalizeMetricKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(total|the|overall|annual|quarterly|monthly|our|company's|global)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Parses numeric values from financial/metric strings
 * (e.g., "$120M" -> 120000000, "99.98%" -> 99.98, "850,000" -> 850000)
 */
function parseNumericValue(rawStr: string): number | null {
  const clean = rawStr.replace(/[$,€£¥\s]/g, '');
  let multiplier = 1;
  if (/m(illion)?\b/i.test(rawStr)) multiplier = 1_000_000;
  else if (/b(illion)?\b/i.test(rawStr)) multiplier = 1_000_000_000;
  else if (/k(k)?\b/i.test(rawStr)) multiplier = 1_000;

  const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return null;
  const parsed = parseFloat(numMatch[1]);
  if (isNaN(parsed)) return null;
  return parsed * multiplier;
}

/**
 * Analyzes documents for:
 * 1. Repetitive related data sets across sections
 * 2. Mistakenly unchanged / stale copied figures across periods or categories
 * 3. Conflicting / mismatched values for the same repeated metric
 * 4. Unchanged template default values in data sets
 */
export function checkRepetitiveAndUnchangedData(
  text: string,
  config?: Partial<RuleConfig>
): {
  issues: QAIssue[];
  extractedMetrics: ExtractedMetric[];
  stats: {
    repeatedMetricsChecked: number;
    conflictingMetricsFound: number;
    staleCopiedDataFound: number;
    unchangedDefaultsFound: number;
  };
} {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  const stats = {
    repeatedMetricsChecked: 0,
    conflictingMetricsFound: 0,
    staleCopiedDataFound: 0,
    unchangedDefaultsFound: 0,
  };

  // Group occurrences by metric name
  const metricMap = new Map<string, { displayName: string; occurrences: MetricOccurrence[] }>();

  // Regex patterns to discover data metric pairs:
  // Pattern A: "Metric Name: $Value" or "Metric Name was $Value" or "Metric Name reached $Value"
  const metricPairRegex = /\b([A-Z][A-Za-z0-9/&–-]{1,20}(?:\s+[A-Za-z0-9/&–-]{1,20}){0,4})\s*(?::|was|were|reached|totaled|stood at|is|equal to|=|at)\s*([$€£¥]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|M|B|k|million|billion|thousand|USD|EUR|GBP|mmHg|days|hours|users|clients|bps)?\b)/gi;

  let match: RegExpExecArray | null;
  while ((match = metricPairRegex.exec(text)) !== null) {
    const rawLabel = match[1].trim();
    const rawValue = match[2].trim();
    const fullMatch = match[0];
    const matchIndex = match.index;

    // Filter out common false-positive labels (like "Section 1", "Chapter 2", "In 2024", "During")
    if (/^(section|chapter|part|page|appendix|figure|table|note|step|version|item|year|in|on|at|during|from|between|after|before)$/i.test(rawLabel)) {
      continue;
    }
    // Filter out labels that are purely numbers or punctuation
    if (!/[a-zA-Z]/.test(rawLabel) || rawLabel.split(/\s+/).length > 6) {
      continue;
    }

    const numVal = parseNumericValue(rawValue);
    if (numVal === null) continue;

    const normKey = normalizeMetricKey(rawLabel);
    if (normKey.length < 3) continue;

    const occurrence: MetricOccurrence = {
      value: rawValue,
      numericValue: numVal,
      rawSnippet: fullMatch,
      startOffset: matchIndex,
      endOffset: matchIndex + fullMatch.length,
      lineNumber: getLineNumber(text, matchIndex),
    };

    if (!metricMap.has(normKey)) {
      metricMap.set(normKey, {
        displayName: rawLabel,
        occurrences: [occurrence],
      });
    } else {
      metricMap.get(normKey)!.occurrences.push(occurrence);
    }
  }

  // Pattern B: Markdown/ASCII Table Rows
  // e.g. | Operating Expenses | $4,250,000 | or - Cohort A: 120 participants
  const tableRowRegex = /^[ \t]*(?:\||-|\*)[ \t]*([A-Za-z0-9/&–-]{1,20}(?:\s+[A-Za-z0-9/&–-]{1,20}){0,4})[ \t]*(?:\||:)[ \t]*([$€£¥]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|M|B|k|million|billion|USD|EUR|participants|patients)?)[ \t]*(?:\||\r?\n|$)/gim;

  while ((match = tableRowRegex.exec(text)) !== null) {
    const rawLabel = match[1].trim();
    const rawValue = match[2].trim();
    const matchIndex = match.index;

    if (/^(metric|item|description|parameter|name|category|cohort|quarter|year)$/i.test(rawLabel)) {
      continue;
    }
    const numVal = parseNumericValue(rawValue);
    if (numVal === null) continue;

    const normKey = normalizeMetricKey(rawLabel);
    if (normKey.length < 3) continue;

    const occurrence: MetricOccurrence = {
      value: rawValue,
      numericValue: numVal,
      rawSnippet: match[0].trim(),
      startOffset: matchIndex,
      endOffset: matchIndex + match[0].length,
      lineNumber: getLineNumber(text, matchIndex),
    };

    if (!metricMap.has(normKey)) {
      metricMap.set(normKey, {
        displayName: rawLabel,
        occurrences: [occurrence],
      });
    } else {
      // Avoid duplicate offset
      const existing = metricMap.get(normKey)!;
      if (!existing.occurrences.some(o => Math.abs(o.startOffset - matchIndex) < 5)) {
        existing.occurrences.push(occurrence);
      }
    }
  }

  // --- CHECK 1: CONFLICTING REPEATED METRICS (Mistaken Input Across Sections) ---
  const extractedMetrics: ExtractedMetric[] = [];

  for (const [key, data] of metricMap.entries()) {
    const occs = data.occurrences;
    stats.repeatedMetricsChecked += occs.length;

    if (occs.length > 1) {
      // Compare numeric values among occurrences
      // Check if there are differing non-zero values for the same metric
      const uniqueValues = new Map<number, MetricOccurrence[]>();
      for (const occ of occs) {
        if (occ.numericValue !== null) {
          // Normalize scale (e.g. 120M vs 120000000)
          const rounded = Math.round(occ.numericValue * 100) / 100;
          if (!uniqueValues.has(rounded)) {
            uniqueValues.set(rounded, []);
          }
          uniqueValues.get(rounded)!.push(occ);
        }
      }

      if (uniqueValues.size > 1) {
        // We found a metric with multiple differing stated values!
        stats.conflictingMetricsFound++;

        const summary = Array.from(uniqueValues.entries())
          .map(([val, list]) => `"${list[0].value}" on line ${list.map(l => l.lineNumber).join(', ')}`)
          .join(' vs ');

        extractedMetrics.push({
          id: `metric-${idCounter}`,
          normalizedName: key,
          displayName: data.displayName,
          occurrences: occs,
          status: 'conflicting',
          discrepancySummary: `Conflicting values reported across document: ${summary}`,
        });

        // Generate QA issue for the diverging occurrences
        const firstOcc = occs[0];
        const laterOccs = occs.slice(1);

        for (const laterOcc of laterOccs) {
          if (laterOcc.numericValue !== firstOcc.numericValue) {
            issues.push({
              id: `rep-conflict-${idCounter++}`,
              category: 'data-continuity',
              severity: 'critical',
              title: `Conflicting Repeated Metric: "${data.displayName}"`,
              description: `"${data.displayName}" was stated as "${firstOcc.value}" on line ${firstOcc.lineNumber}, but is reported here as "${laterOcc.value}" on line ${laterOcc.lineNumber}. One of these figures may be mistakenly entered or un-reconciled.`,
              originalText: laterOcc.rawSnippet,
              suggestedText: laterOcc.rawSnippet.replace(laterOcc.value, firstOcc.value),
              startOffset: laterOcc.startOffset,
              endOffset: laterOcc.endOffset,
              lineNumber: laterOcc.lineNumber,
              ruleId: 'conflicting-repeated-metric',
              autoApplicable: false,
              explanation: `Data continuity requires metrics cited in multiple locations (e.g. executive summary vs financial tables) to match. Discrepancies often occur when a figure was updated in one section but left unchanged in another.`,
            });
          }
        }
      } else {
        // Values match across repetitions
        extractedMetrics.push({
          id: `metric-${idCounter++}`,
          normalizedName: key,
          displayName: data.displayName,
          occurrences: occs,
          status: 'consistent',
        });
      }
    } else {
      extractedMetrics.push({
        id: `metric-${idCounter++}`,
        normalizedName: key,
        displayName: data.displayName,
        occurrences: occs,
        status: 'single',
      });
    }
  }

  // --- CHECK 2: MISTAKENLY UNCHANGED / STALE COPIED DATA SETS ---
  // Detects identical complex multi-digit numbers or exact tabular rows across consecutive periods (e.g. Q1, Q2, Q3)
  // or across distinct comparison categories (e.g. North America vs Europe vs APAC).
  const periodPattern = /\b(Q[1-4]|202[0-9]|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Phase\s+[I|V|X]+|Cohort\s+[A-Z]|Region\s+[A-Z]|Tier\s+[0-9A-Z]+)\b[^\n\r$€£¥\d]{1,60}([$€£¥]?\s*\d{2,}(?:,\d{3})*(?:\.\d+)?\s*(?:M|B|k|%|USD|EUR)?)/gi;

  const periodMatches: { period: string; fullSnippet: string; rawNumber: string; numericVal: number; offset: number; line: number }[] = [];
  while ((match = periodPattern.exec(text)) !== null) {
    const period = match[1].trim();
    const rawNum = match[2].trim();
    const numVal = parseNumericValue(rawNum);
    // Ignore round or simple small numbers like "10", "1", "0"
    if (numVal !== null && numVal > 100 && !rawNum.endsWith('000000')) {
      periodMatches.push({
        period,
        fullSnippet: match[0],
        rawNumber: rawNum,
        numericVal: numVal,
        offset: match.index,
        line: getLineNumber(text, match.index),
      });
    }
  }

  // Find consecutive period entries that share the EXACT same non-trivial multi-digit number
  for (let i = 0; i < periodMatches.length - 1; i++) {
    const current = periodMatches[i];
    const next = periodMatches[i + 1];

    if (current.period !== next.period && current.numericVal === next.numericVal && Math.abs(current.offset - next.offset) < 600) {
      stats.staleCopiedDataFound++;
      issues.push({
        id: `rep-stale-${idCounter++}`,
        category: 'data-continuity',
        severity: 'warning',
        title: `Suspected Stale / Unchanged Copied Data (${next.period})`,
        description: `Identical non-trivial value "${next.rawNumber}" appears for both ${current.period} and ${next.period}. In recurring reports, this frequently indicates that data was copy-pasted from the previous period and mistakenly left unchanged.`,
        originalText: next.fullSnippet,
        suggestedText: next.fullSnippet,
        startOffset: next.offset,
        endOffset: next.offset + next.fullSnippet.length,
        lineNumber: next.line,
        ruleId: 'stale-copy-paste-data',
        autoApplicable: false,
        explanation: `Verify whether ${next.period} actually produced the exact same figure (${next.rawNumber}) as ${current.period}, or if the data cell requires updating with current-period results.`,
      });
    }
  }

  // --- CHECK 3: UNCHANGED TEMPLATE DEFAULTS IN DATA SETS ---
  // Detects multiple repetitive entries left as default template values: e.g. 0.00%, $0.00, TBD, N/A, 100.0%, 000
  const templateDefaultRegex = /^[ \t]*(?:\||-|\*)[ \t]*([A-Za-z0-9\s/&–-]{2,30}?)[ \t]*(?:\||:)[ \t]*([$€£¥]?\s*0(?:\.00?)?\s*%?|N\/A|TBD|XX\.X%|0\.0%|000|0|\$0\.00)[ \t]*(?:\||\r?\n|$)/gim;

  const defaultEntries: { label: string; value: string; offset: number; line: number; full: string }[] = [];
  while ((match = templateDefaultRegex.exec(text)) !== null) {
    defaultEntries.push({
      label: match[1].trim(),
      value: match[2].trim(),
      offset: match.index,
      line: getLineNumber(text, match.index),
      full: match[0].trim(),
    });
  }

  if (defaultEntries.length >= 2) {
    stats.unchangedDefaultsFound += defaultEntries.length;
    for (const entry of defaultEntries) {
      issues.push({
        id: `rep-default-${idCounter++}`,
        category: 'placeholder',
        severity: 'warning',
        title: `Unchanged Template Default: "${entry.label}"`,
        description: `The entry "${entry.label}" contains a default placeholder value ("${entry.value}"). Confirm this cell was not accidentally left unpopulated from a template.`,
        originalText: entry.full,
        suggestedText: entry.full,
        startOffset: entry.offset,
        endOffset: entry.offset + entry.full.length,
        lineNumber: entry.line,
        ruleId: 'unchanged-template-default',
        autoApplicable: false,
        explanation: `Template grids often initialize rows with 0.00% or N/A. Ensure all live figures have been input prior to report finalization.`,
      });
    }
  }

  // Sort extracted metrics alphabetically by displayName
  extractedMetrics.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    issues,
    extractedMetrics,
    stats,
  };
}
