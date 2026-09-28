import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

export interface TimelineEvent {
  id: string;
  eventType: 'loss' | 'police' | 'intimation' | 'survey' | 'estimate' | 'report' | 'policy_start' | 'policy_end' | 'general';
  label: string;
  rawDateStr: string;
  dateObj: Date | null;
  lineNumber: number;
  offset: number;
  snippet: string;
  anomaly?: string;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Robust date parser supporting DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, and natural text (15-Oct-2023, October 15, 2023)
 */
export function parseDocumentDate(dateStr: string): Date | null {
  const clean = dateStr.trim();

  // 1. Natural date: 15 October 2023, 15-Oct-2023, Oct 15, 2023
  const naturalMatch = clean.match(/(?:(\d{1,2})[\s\/-])?([a-zA-Z]{3,9})[\s\/-](\d{1,2})?(?:,?\s*(\d{4}))/i);
  if (naturalMatch) {
    const monthStr = naturalMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthStr];
    const day = parseInt(naturalMatch[1] || naturalMatch[3] || '1', 10);
    const year = parseInt(naturalMatch[4], 10);

    if (month !== undefined && !isNaN(day) && !isNaN(year) && year > 1900 && year < 2100) {
      const d = new Date(year, month, day);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return d;
      }
    }
  }

  // 2. YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const date = new Date(y, m, d);
    if (date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) {
      return date;
    }
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = clean.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const y = parseInt(slashMatch[3], 10);

    // Assume DD/MM/YYYY if p1 > 12, or default Commonwealth standard
    let d = p1;
    let m = p2 - 1;
    if (p1 > 12 && p2 <= 12) {
      d = p1;
      m = p2 - 1;
    } else if (p2 > 12 && p1 <= 12) {
      // MM/DD/YYYY
      m = p1 - 1;
      d = p2;
    }

    const date = new Date(y, m, d);
    if (date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) {
      return date;
    }
  }

  return null;
}

/**
 * Intelligent Chronological & Causality Timeline Engine
 */
export function analyzeDocumentTimeline(documentText: string): {
  issues: QAIssue[];
  events: TimelineEvent[];
} {
  const issues: QAIssue[] = [];
  const events: TimelineEvent[] = [];
  let idCounter = 1;

  // Patterns for milestone dates
  const DATE_MILESTONES = [
    {
      type: 'policy_start' as const,
      label: 'Policy Inception Date',
      regex: /(?:policy\s*(?:inception|period\s*from|start|commencement)|valid\s*from|effective\s*from)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
    {
      type: 'policy_end' as const,
      label: 'Policy Expiry Date',
      regex: /(?:policy\s*(?:expiry|period\s*to|expiration|valid\s*upto|valid\s*to)|effective\s*to)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
    {
      type: 'loss' as const,
      label: 'Date of Loss / Accident',
      regex: /(?:date\s*of\s*(?:loss|accident|incident|occurrence|damage|casualty)|loss\s*date|accident\s*date)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
    {
      type: 'police' as const,
      label: 'Date of Police FIR / GD Entry',
      regex: /(?:date\s*of\s*(?:fir|police\s*report|police\s*intimation|gd\s*entry)|fir\s*date)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
    {
      type: 'intimation' as const,
      label: 'Date of Claim Intimation',
      regex: /(?:date\s*of\s*(?:intimation|claim\s*intimation|notification)|intimation\s*date)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
    {
      type: 'survey' as const,
      label: 'Date of Survey / Inspection',
      regex: /(?:date\s*of\s*(?:survey|inspection|assessment|site\s*visit|examination)|survey\s*date|inspection\s*date)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
    {
      type: 'estimate' as const,
      label: 'Date of Repair Estimate',
      regex: /(?:date\s*of\s*(?:estimate|quotation|repair\s*estimate|bill)|estimate\s*date)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
    {
      type: 'report' as const,
      label: 'Date of Report Submission',
      regex: /(?:date\s*of\s*(?:report|submission|issuance|release)|report\s*date|dated)\s*[:=–-]?\s*([A-Za-z0-9\/\-\s,\.]{8,24})/i,
    },
  ];

  // Extract milestones
  DATE_MILESTONES.forEach(({ type, label, regex }) => {
    const match = regex.exec(documentText);
    if (match && match[1]) {
      const rawDate = match[1].trim().replace(/[\r\n].*$/, '').replace(/[;,].*$/, '').trim();
      const parsedDate = parseDocumentDate(rawDate);
      const lineNum = getLineNumber(documentText, match.index);

      events.push({
        id: `tl-event-${type}-${idCounter++}`,
        eventType: type,
        label,
        rawDateStr: rawDate,
        dateObj: parsedDate,
        lineNumber: lineNum,
        offset: match.index,
        snippet: match[0],
      });
    }
  });

  // Check Calendar Impossibilities (e.g. 29 Feb on non-leap years, 31 April)
  const invalidDateRegex = /\b(?:(31)[-\/\s](?:0?4|0?6|0?9|11|Apr|Jun|Sep|Nov)|(29|30|31)[-\/\s](?:0?2|Feb))[-\/\s](\d{4})\b/gi;
  let invMatch: RegExpExecArray | null;
  while ((invMatch = invalidDateRegex.exec(documentText)) !== null) {
    const day = parseInt(invMatch[1] || invMatch[2], 10);
    const year = parseInt(invMatch[3], 10);
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

    let isInvalid = false;
    let reason = '';

    if (day === 31 && invMatch[1]) {
      isInvalid = true;
      reason = 'has only 30 days';
    } else if (invMatch[2]) {
      if (day > 29) {
        isInvalid = true;
        reason = 'February never has 30 or 31 days';
      } else if (day === 29 && !isLeap) {
        isInvalid = true;
        reason = `${year} is not a leap year (February 29 does not exist)`;
      }
    }

    if (isInvalid) {
      const lineNum = getLineNumber(documentText, invMatch.index);
      issues.push({
        id: `calendar-invalid-${idCounter++}`,
        category: 'data-continuity',
        severity: 'critical',
        title: 'Non-Existent Calendar Date',
        description: `The date "${invMatch[0]}" is impossible on the calendar: ${reason}.`,
        originalText: invMatch[0],
        suggestedText: invMatch[0],
        startOffset: invMatch.index,
        endOffset: invMatch.index + invMatch[0].length,
        lineNumber: lineNum,
        ruleId: 'calendar-date-validity',
        autoApplicable: false,
        explanation: `Reports must not cite invalid dates that do not exist on the Gregorian calendar.`,
      });
    }
  }

  // Cross-Validate Causality Between Milestone Dates
  const getEvent = (type: TimelineEvent['eventType']) => events.find((e) => e.eventType === type && e.dateObj !== null);

  const lossEvent = getEvent('loss');
  const surveyEvent = getEvent('survey');
  const reportEvent = getEvent('report');
  const policyStart = getEvent('policy_start');
  const policyEnd = getEvent('policy_end');
  const policeEvent = getEvent('police');
  const intimationEvent = getEvent('intimation');

  // 1. Loss Date vs Policy Period (Coverage Causality)
  if (lossEvent?.dateObj && policyEnd?.dateObj) {
    if (lossEvent.dateObj > policyEnd.dateObj) {
      lossEvent.anomaly = `Loss date is after Policy Expiry date (${policyEnd.rawDateStr})`;
      issues.push({
        id: `causality-policy-expired-${idCounter++}`,
        category: 'data-continuity',
        severity: 'critical',
        title: 'Chronological Contradiction: Loss After Policy Expiry',
        description: `Date of Loss (${lossEvent.rawDateStr}) occurs AFTER the Policy Expiry Date (${policyEnd.rawDateStr}). This would signify an uncovered loss unless policy was formally renewed.`,
        originalText: lossEvent.snippet,
        suggestedText: lossEvent.snippet,
        startOffset: lossEvent.offset,
        endOffset: lossEvent.offset + lossEvent.snippet.length,
        lineNumber: lossEvent.lineNumber,
        ruleId: 'chronological-coverage-continuity',
        autoApplicable: false,
        explanation: `In claims evaluation, loss dates must strictly fall within the active policy inception and expiration timeline.`,
      });
    }
  }

  if (lossEvent?.dateObj && policyStart?.dateObj) {
    if (lossEvent.dateObj < policyStart.dateObj) {
      lossEvent.anomaly = `Loss date precedes Policy Inception date (${policyStart.rawDateStr})`;
      issues.push({
        id: `causality-policy-before-${idCounter++}`,
        category: 'data-continuity',
        severity: 'critical',
        title: 'Chronological Contradiction: Loss Before Policy Inception',
        description: `Date of Loss (${lossEvent.rawDateStr}) is recorded as occurring BEFORE Policy Inception (${policyStart.rawDateStr}).`,
        originalText: lossEvent.snippet,
        suggestedText: lossEvent.snippet,
        startOffset: lossEvent.offset,
        endOffset: lossEvent.offset + lossEvent.snippet.length,
        lineNumber: lossEvent.lineNumber,
        ruleId: 'chronological-coverage-continuity',
        autoApplicable: false,
        explanation: `A loss cannot predate policy commencement. Verify the policy schedule and loss dates.`,
      });
    }
  }

  // 2. Loss Date vs Survey Date (Physical Inspection Causality)
  if (lossEvent?.dateObj && surveyEvent?.dateObj) {
    if (surveyEvent.dateObj < lossEvent.dateObj) {
      surveyEvent.anomaly = `Survey date precedes reported Loss Date (${lossEvent.rawDateStr})`;
      issues.push({
        id: `causality-survey-before-loss-${idCounter++}`,
        category: 'data-continuity',
        severity: 'critical',
        title: 'Chronological Anomaly: Inspection Predates Loss',
        description: `Physical survey/inspection was conducted on ${surveyEvent.rawDateStr}, which is PRIOR to the stated Date of Loss (${lossEvent.rawDateStr}).`,
        originalText: surveyEvent.snippet,
        suggestedText: surveyEvent.snippet,
        startOffset: surveyEvent.offset,
        endOffset: surveyEvent.offset + surveyEvent.snippet.length,
        lineNumber: surveyEvent.lineNumber,
        ruleId: 'inspection-loss-causality',
        autoApplicable: false,
        explanation: `A surveyor cannot inspect accidental damage before the accident occurs. Check for typographical transposition of month or day.`,
      });
    }
  }

  // 3. Survey Date vs Report Submission Date
  if (surveyEvent?.dateObj && reportEvent?.dateObj) {
    if (reportEvent.dateObj < surveyEvent.dateObj) {
      reportEvent.anomaly = `Report submission date precedes Inspection date (${surveyEvent.rawDateStr})`;
      issues.push({
        id: `causality-report-before-survey-${idCounter++}`,
        category: 'data-continuity',
        severity: 'critical',
        title: 'Chronological Anomaly: Report Issued Prior to Survey',
        description: `Final report date (${reportEvent.rawDateStr}) precedes the on-site physical survey date (${surveyEvent.rawDateStr}).`,
        originalText: reportEvent.snippet,
        suggestedText: reportEvent.snippet,
        startOffset: reportEvent.offset,
        endOffset: reportEvent.offset + reportEvent.snippet.length,
        lineNumber: reportEvent.lineNumber,
        ruleId: 'report-issuance-causality',
        autoApplicable: false,
        explanation: `Final technical and survey reports cannot be signed and issued before the physical assessment has taken place.`,
      });
    }
  }

  return { issues, events };
}
