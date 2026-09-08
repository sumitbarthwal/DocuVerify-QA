import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

export interface WorkflowDateEntry {
  stageKey: string;
  stageName: string;
  stageRank: number;
  rawSnippet: string;
  rawDate: string;
  timestamp: number;
  formattedDate: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
}

export interface IdentifierOccurrence {
  type: 'policy' | 'claim' | 'registration' | 'survey_ref';
  label: string;
  identifierValue: string;
  rawSnippet: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
}

/**
 * Parses diverse date formats:
 * - DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
 * - 15 Aug 2024, 15th August 2024, 15-Aug-2024
 * - August 15, 2024, Aug 15 2024
 */
export function parseSurveyingDate(raw: string): { timestamp: number; formatted: string } | null {
  const clean = raw.trim().replace(/(?:st|nd|rd|th)/gi, '');

  // Month mapping
  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);

    // Standard surveyor convention is DD/MM/YYYY unless month > 12
    if (day > 12 && month <= 11) {
      // Unambiguously DD/MM/YYYY
    } else if (month > 11 && day <= 12) {
      // Was MM/DD/YYYY
      const temp = day;
      day = month + 1;
      month = temp - 1;
    }

    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return {
        timestamp: d.getTime(),
        formatted: d.toISOString().split('T')[0],
      };
    }
  }

  // Pattern 2: YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return {
        timestamp: d.getTime(),
        formatted: d.toISOString().split('T')[0],
      };
    }
  }

  // Pattern 3: 15 Aug 2024 or 15-Aug-2024 or 15 August 2024
  const verbal1 = clean.match(/^(\d{1,2})[\s\-]+([a-zA-Z]{3,10})[\s\-]+(\d{4})$/);
  if (verbal1) {
    const day = parseInt(verbal1[1], 10);
    const mStr = verbal1[2].toLowerCase();
    const year = parseInt(verbal1[3], 10);
    if (months[mStr] !== undefined) {
      const d = new Date(year, months[mStr], day);
      if (!isNaN(d.getTime())) {
        return {
          timestamp: d.getTime(),
          formatted: d.toISOString().split('T')[0],
        };
      }
    }
  }

  // Pattern 4: August 15, 2024 or Aug 15 2024
  const verbal2 = clean.match(/^([a-zA-Z]{3,10})[\s\-]+(\d{1,2}),?[\s\-]+(\d{4})$/);
  if (verbal2) {
    const mStr = verbal2[1].toLowerCase();
    const day = parseInt(verbal2[2], 10);
    const year = parseInt(verbal2[3], 10);
    if (months[mStr] !== undefined) {
      const d = new Date(year, months[mStr], day);
      if (!isNaN(d.getTime())) {
        return {
          timestamp: d.getTime(),
          formatted: d.toISOString().split('T')[0],
        };
      }
    }
  }

  return null;
}

/**
 * 1. Surveying Workflow Chronological Sequence Validator:
 * Validates: Date of Loss <= Date of Intimation <= Date of Initial Survey
 * <= Successive Visits / Re-inspection <= Assessment Sharing <= Consent Receipt / Final Report
 */
export function checkSurveyingDateSequence(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  const STAGES = [
    {
      key: 'loss',
      rank: 1,
      name: 'Date of Loss / Occurrence',
      regex: /\b(?:date\s+of\s+(?:loss|accident|occurrence|damage|incident)|incident\s+date|accident\s+date|loss\s+occurred\s+on)\s*[:=–-]?\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/gi,
    },
    {
      key: 'intimation',
      rank: 2,
      name: 'Date of Intimation / Appointment',
      regex: /\b(?:date\s+of\s+(?:intimation|appointment|deputation|instructions?|allotment)|intimation\s+date|appointment\s+date|deputed\s+on|intimated\s+on)\s*[:=–-]?\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/gi,
    },
    {
      key: 'survey',
      rank: 3,
      name: 'Date of Survey / Inspection',
      regex: /\b(?:date\s+of\s+(?:survey|initial\s+survey|preliminary\s+inspection|first\s+inspection|site\s+visit)|survey\s+date|inspection\s+date|surveyed\s+on|inspected\s+on)\s*[:=–-]?\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/gi,
    },
    {
      key: 'reinspection',
      rank: 4,
      name: 'Date of Re-inspection / Successive Visit',
      regex: /\b(?:date\s+of\s+(?:re-?inspection|subsequent\s+visit|successive\s+visit|joint\s+inspection|second\s+visit)|re-?inspection\s+date|final\s+inspection\s+date|re-?inspected\s+on)\s*[:=–-]?\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/gi,
    },
    {
      key: 'assessment_sharing',
      rank: 5,
      name: 'Date of Assessment Sharing',
      regex: /\b(?:date\s+of\s+(?:assessment\s+sharing|sharing\s+assessment|draft\s+submission)|assessment\s+shared\s+on|draft\s+submitted\s+on)\s*[:=–-]?\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/gi,
    },
    {
      key: 'consent',
      rank: 6,
      name: 'Date of Consent Receipt / Final Report',
      regex: /\b(?:date\s+of\s+(?:consent\s+receipt|insured\s+consent|consent|discharge\s+voucher)|consent\s+received\s+on|discharge\s+signed\s+on)\s*[:=–-]?\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/gi,
    },
  ];

  const detectedStages: WorkflowDateEntry[] = [];

  for (const stage of STAGES) {
    let match: RegExpExecArray | null;
    const rx = new RegExp(stage.regex.source, stage.regex.flags);
    while ((match = rx.exec(text)) !== null) {
      const rawDateStr = match[1].trim();
      const parsed = parseSurveyingDate(rawDateStr);
      if (parsed) {
        detectedStages.push({
          stageKey: stage.key,
          stageName: stage.name,
          stageRank: stage.rank,
          rawSnippet: match[0],
          rawDate: rawDateStr,
          timestamp: parsed.timestamp,
          formattedDate: parsed.formatted,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          lineNumber: getLineNumber(text, match.index),
        });
      }
    }
  }

  // Check sequence rules: For any two stages where stageA.rank < stageB.rank,
  // stageA.timestamp MUST BE <= stageB.timestamp (allowing same day)
  for (let i = 0; i < detectedStages.length; i++) {
    for (let j = 0; j < detectedStages.length; j++) {
      if (i === j) continue;
      const stageA = detectedStages[i];
      const stageB = detectedStages[j];

      if (stageA.stageRank < stageB.stageRank) {
        // stageA is supposed to happen before or on the same day as stageB
        if (stageA.timestamp > stageB.timestamp) {
          // Inversion! (e.g. Survey Date before Loss Date, or Consent Date before Assessment Date)
          issues.push({
            id: `surv-date-seq-${idCounter++}`,
            category: 'data-continuity',
            severity: 'critical',
            title: `Surveying Workflow Inversion: ${stageA.stageName} vs ${stageB.stageName}`,
            description: `Logical sequence error: ${stageA.stageName} is reported as "${stageA.rawDate}" (line ${stageA.lineNumber}), which is AFTER ${stageB.stageName} ("${stageB.rawDate}" on line ${stageB.lineNumber}). In loss surveying procedure, ${stageB.stageName} cannot precede ${stageA.stageName}.`,
            originalText: stageB.rawSnippet,
            suggestedText: stageB.rawSnippet,
            startOffset: stageB.startOffset,
            endOffset: stageB.endOffset,
            lineNumber: stageB.lineNumber,
            ruleId: 'surveying-date-sequence-inversion',
            autoApplicable: false,
            explanation: `Surveying & loss assessment compliance dictates the chronological sequence: Date of Loss ≤ Date of Intimation ≤ Date of Survey ≤ Re-inspection Visits ≤ Assessment Sharing ≤ Consent Receipt. Please verify the actual calendar dates.`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 2. Identifier Consistency Checker (Policy No, Claim No, Registration / Chassis No):
 * Detects if a policy number (or claim number) is replaced in one section of the report
 * but mistakenly left unchanged (e.g. from an old template) in another section or in the notes!
 */
export function checkSurveyingIdentifiers(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  const IDENTIFIER_CONFIGS = [
    {
      type: 'policy' as const,
      label: 'Policy Number',
      regex: /\b(?:policy\s*(?:no\.?|number|#|ref(?:erence)?))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{5,32})\b/gi,
    },
    {
      type: 'claim' as const,
      label: 'Claim Number',
      regex: /\b(?:claim\s*(?:no\.?|number|#|ref(?:erence)?))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{5,32})\b/gi,
    },
    {
      type: 'registration' as const,
      label: 'Vehicle / Asset Reg No',
      regex: /\b(?:(?:vehicle\s*)?reg(?:istration)?\s*(?:no\.?|number|#)|chassis\s*(?:no\.?|number)|asset\s*(?:id|no\.?))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{5,25})\b/gi,
    },
    {
      type: 'survey_ref' as const,
      label: 'Survey Reference No',
      regex: /\b(?:survey\s*(?:ref(?:erence)?|report\s*(?:no\.?|number|#)))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{5,30})\b/gi,
    },
  ];

  for (const cfg of IDENTIFIER_CONFIGS) {
    let match: RegExpExecArray | null;
    const occurrences: IdentifierOccurrence[] = [];
    const rx = new RegExp(cfg.regex.source, cfg.regex.flags);

    while ((match = rx.exec(text)) !== null) {
      const val = match[1].trim();
      // Exclude placeholder labels like "XXXX", "TBD", "NOT_AVAILABLE"
      if (/^(tbd|tba|xxxx|pending|nil|na|n\/a)$/i.test(val)) continue;

      occurrences.push({
        type: cfg.type,
        label: cfg.label,
        identifierValue: val,
        rawSnippet: match[0],
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        lineNumber: getLineNumber(text, match.index),
      });
    }

    if (occurrences.length > 1) {
      // Group occurrences by normalized identifier
      const valueMap = new Map<string, IdentifierOccurrence[]>();
      for (const occ of occurrences) {
        const norm = occ.identifierValue.toUpperCase();
        if (!valueMap.has(norm)) {
          valueMap.set(norm, []);
        }
        valueMap.get(norm)!.push(occ);
      }

      // If more than one distinct identifier was found for this field,
      // it means an inconsistent / wrong policy number or reference was entered or left unchanged!
      if (valueMap.size > 1) {
        // Find the dominant / primary identifier (most frequent or first declared)
        const sortedEntries = Array.from(valueMap.entries()).sort((a, b) => b[1].length - a[1].length);
        const [primaryKey, primaryList] = sortedEntries[0];
        const primaryVal = primaryList[0].identifierValue;

        // Any occurrence that diverges from the primary identifier is flagged as a variant error
        for (let i = 1; i < sortedEntries.length; i++) {
          const [divergentKey, divergentList] = sortedEntries[i];
          for (const divergentOcc of divergentList) {
            const correctedSnippet = divergentOcc.rawSnippet.replace(
              divergentOcc.identifierValue,
              primaryVal
            );

            issues.push({
              id: `surv-id-conflict-${idCounter++}`,
              category: 'data-continuity',
              severity: 'critical',
              title: `Conflicting ${cfg.label} Variant (${divergentOcc.identifierValue})`,
              description: `${cfg.label} is cited as "${divergentOcc.identifierValue}" on line ${divergentOcc.lineNumber}, whereas line ${primaryList[0].lineNumber} specifies "${primaryVal}". In surveying and insurance reports, this occurs when an old template's identifier is replaced in one section but left unchanged in assessment notes or summary remarks.`,
              originalText: divergentOcc.rawSnippet,
              suggestedText: correctedSnippet,
              startOffset: divergentOcc.startOffset,
              endOffset: divergentOcc.endOffset,
              lineNumber: divergentOcc.lineNumber,
              ruleId: 'conflicting-identifier-variant',
              autoApplicable: true,
              explanation: `All sections, schedules, and assessment notes of an official surveying report must consistently cite the exact same ${cfg.label}.`,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * 3. Assessment Table vs. Assessment Notes Cross-Reconciliation:
 * Compares figures itemized in the Assessment Table / Schedule of Loss
 * against figures cited in the "Notes to Assessment" or "Remarks on Assessment".
 */
export function checkAssessmentTableVsNotes(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  // Key assessment metrics to cross-verify between schedule tables and narrative notes
  const KEY_METRICS = [
    {
      key: 'salvage',
      label: 'Salvage / Scrap Value',
      regex: /\b(?:salvage(?:\s+value|\s+deduction|\s+recovery)?|scrap\s+value)\b[^\n\r$€£¥\d]{0,40}(?:[:=–-]|was|is|at|of|less)?\s*([$€£¥]?\s*\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    },
    {
      key: 'depreciation',
      label: 'Depreciation Amount',
      regex: /\b(?:depreciation(?:\s+deducted|\s+amount|\s+on\s+parts)?)\b[^\n\r$€£¥\d]{0,40}(?:[:=–-]|was|is|at|of|less)?\s*([$€£¥]?\s*\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    },
    {
      key: 'excess',
      label: 'Policy Excess / Deductible',
      regex: /\b(?:policy\s+excess|deductible|compulsory\s+excess)\b[^\n\r$€£¥\d]{0,40}(?:[:=–-]|was|is|at|of|less)?\s*([$€£¥]?\s*\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    },
    {
      key: 'net_assessed',
      label: 'Net Assessed / Adjusted Liability',
      regex: /\b(?:net\s+assessed(?:\s+loss|\s+amount)?|net\s+adjusted\s+loss|net\s+insurer'?s?\s+liability|net\s+claim\s+payable|final\s+assessed\s+amount)\b[^\n\r$€£¥\d]{0,40}(?:[:=–-]|was|is|at|of|totaling)?\s*([$€£¥]?\s*\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    },
  ];

  for (const metric of KEY_METRICS) {
    let match: RegExpExecArray | null;
    const rx = new RegExp(metric.regex.source, metric.regex.flags);
    const mentions: { rawNum: string; numericVal: number; snippet: string; offset: number; line: number }[] = [];

    while ((match = rx.exec(text)) !== null) {
      const rawNum = match[1].trim();
      const numVal = parseFloat(rawNum.replace(/[$,€£¥\s]/g, ''));
      if (!isNaN(numVal) && numVal > 0) {
        mentions.push({
          rawNum,
          numericVal: numVal,
          snippet: match[0],
          offset: match.index,
          line: getLineNumber(text, match.index),
        });
      }
    }

    if (mentions.length > 1) {
      // Check if values mismatch across occurrences (e.g. Table vs Notes)
      const first = mentions[0];
      for (let i = 1; i < mentions.length; i++) {
        const other = mentions[i];
        if (Math.abs(first.numericVal - other.numericVal) > 0.01) {
          issues.push({
            id: `surv-table-note-mismatch-${idCounter++}`,
            category: 'data-continuity',
            severity: 'critical',
            title: `Assessment Table vs. Notes Discrepancy (${metric.label})`,
            description: `Divergent figure for "${metric.label}": Stated as "${first.rawNum}" on line ${first.line}, but cited as "${other.rawNum}" on line ${other.line}. Notes to assessment must strictly reconcile with the final assessment schedule.`,
            originalText: other.snippet,
            suggestedText: other.snippet.replace(other.rawNum, first.rawNum),
            startOffset: other.offset,
            endOffset: other.offset + other.snippet.length,
            lineNumber: other.line,
            ruleId: 'assessment-table-notes-discrepancy',
            autoApplicable: false,
            explanation: `Insurance claim auditors cross-examine particulars in the remarks/notes against the assessment computation table. Reconcile both sections to state the exact agreed figure.`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 4. Unlinked / Non-Correlating Material Particulars:
 * - Stray / Unrelated Insured Entity or Third-Party Company Name (template residue)
 * - Place of Loss vs. Place of Survey Location mismatch without documented transit
 * - Unlinked Annexures / Exhibits (e.g., "Refer to Annexure IV" when Annexure IV doesn't exist)
 */
export function checkUnlinkedMaterialParticulars(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  // A. Insured Entity Correlation
  const insuredMatch = text.match(/\b(?:insured(?:\s+name)?|name\s+of\s+insured)\s*[:=–-]?\s*([^\n\r,;\(]{4,60})/i);
  if (insuredMatch) {
    const primaryInsured = insuredMatch[1].trim();
    const primaryWords = new Set(
      primaryInsured
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => !['ltd', 'limited', 'pvt', 'inc', 'corp', 'corporation', 'co', 'the', 'and', 'm/s', 'of', '&'].includes(w) && w.length > 2)
    );

    const strayInsuredRegex = /\b(?:insured\s+(?:m\/s\.?|company|entity|firm|proprietor)|goods\s+belonging\s+to\s+(?:m\/s\.?)?)\s*([A-Z][A-Za-z0-9\s&]{3,40}(?:Ltd|Limited|Pvt|Corp|Corporation|Inc|Enterprises|Logistics|Industries))\b/gi;
    let strayMatch: RegExpExecArray | null;
    while ((strayMatch = strayInsuredRegex.exec(text)) !== null) {
      const candidate = strayMatch[1].trim();
      const candWords = candidate.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
      const overlaps = candWords.some(w => primaryWords.has(w));
      if (!overlaps && candWords.length >= 1) {
        issues.push({
          id: `surv-unlinked-entity-${idCounter++}`,
          category: 'data-continuity',
          severity: 'critical',
          title: `Unlinked Insured Entity / Stray Company Name (${candidate})`,
          description: `The report declares the Insured as "${primaryInsured}", but line ${getLineNumber(text, strayMatch.index)} refers to "${candidate}". This is a common template defect where an entity name from a prior case was left in the narrative remarks.`,
          originalText: strayMatch[0],
          suggestedText: strayMatch[0].replace(candidate, primaryInsured),
          startOffset: strayMatch.index,
          endOffset: strayMatch.index + strayMatch[0].length,
          lineNumber: getLineNumber(text, strayMatch.index),
          ruleId: 'unlinked-insured-entity',
          autoApplicable: false,
          explanation: `In loss assessment documents, citing an unlinked company or stray insured name invalidates report authority and can lead to claim repudiation during audit.`,
        });
      }
    }
  }

  // B. Place of Loss vs. Place of Survey Location
  const lossLocMatch = text.match(/\b(?:place\s+of\s+(?:loss|accident|occurrence)|loss\s+location)\s*[:=–-]?\s*([^\n\r,;]{3,50})/i);
  const survLocMatch = text.match(/\b(?:place\s+of\s+(?:survey|inspection)|survey\s+location|inspected\s+at)\s*[:=–-]?\s*([^\n\r,;]{3,50})/i);

  if (lossLocMatch && survLocMatch) {
    const lossLoc = lossLocMatch[1].trim();
    const survLoc = survLocMatch[1].trim();

    const lossLocWords = lossLoc.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    const survLocWords = survLoc.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    const sharesWord = lossLocWords.some(w => survLocWords.includes(w));

    if (!sharesWord && lossLocWords.length > 0 && survLocWords.length > 0) {
      const hasTransitExplanation = /\b(?:towed|transported|shifted|transferred|dispatched|brought\s+to|shifted\s+to|authorized\s+workshop|depot|yard|transit)\b/i.test(text);
      if (!hasTransitExplanation) {
        issues.push({
          id: `surv-location-divergence-${idCounter++}`,
          category: 'data-continuity',
          severity: 'warning',
          title: `Survey Location ("${survLoc}") Diverges from Loss Location ("${lossLoc}")`,
          description: `Place of Loss is specified as "${lossLoc}" (line ${getLineNumber(text, lossLocMatch.index ?? 0)}), but Survey was conducted at "${survLoc}" (line ${getLineNumber(text, survLocMatch.index ?? 0)}) without explicit mention of vehicle/cargo towing or transit to workshop.`,
          originalText: survLocMatch[0],
          suggestedText: survLocMatch[0],
          startOffset: lossLocMatch.index ?? 0,
          endOffset: (lossLocMatch.index ?? 0) + lossLocMatch[0].length,
          lineNumber: getLineNumber(text, lossLocMatch.index ?? 0),
          ruleId: 'unlinked-location-variance',
          autoApplicable: false,
          explanation: `Insurers require a documented nexus when inspection occurs at a different location from the casualty (e.g. "vehicle was subsequently towed to workshop").`,
        });
      }
    }
  }

  // C. Unlinked / Orphaned Annexures & Exhibits
  const refRegex = /\b(?:refer\s+to\s+(?:annexure|exhibit|appendix|enclosure)|attached\s+as\s+(?:annexure|exhibit|appendix)|see\s+(?:annexure|exhibit|appendix))\s*([A-Za-z0-9\-–IVXLCDM]+)/gi;
  let refMatch: RegExpExecArray | null;
  while ((refMatch = refRegex.exec(text)) !== null) {
    const rawRefId = refMatch[1].trim();
    const defRegex = new RegExp(`(?:##|###|\\b)(?:annexure|exhibit|appendix|enclosure)\\s*[-–:]?\\s*${rawRefId.replace(/[-–]/g, '[-–]?')}\\b`, 'i');
    if (!defRegex.test(text)) {
      issues.push({
        id: `surv-unlinked-annexure-${idCounter++}`,
        category: 'data-continuity',
        severity: 'warning',
        title: `Unlinked Supporting Reference (${refMatch[0]})`,
        description: `Text cites "${refMatch[0]}" on line ${getLineNumber(text, refMatch.index)}, but no corresponding Annexure, Exhibit, or Enclosure header is attached or defined in the document.`,
        originalText: refMatch[0],
        suggestedText: refMatch[0],
        startOffset: refMatch.index,
        endOffset: refMatch.index + refMatch[0].length,
        lineNumber: getLineNumber(text, refMatch.index),
        ruleId: 'unlinked-annexure-reference',
        autoApplicable: false,
        explanation: `In loss surveying, all cited annexures (such as Police FIR, Meteorological Report, or Driving License verification) must be attached and indexed.`,
      });
    }
  }

  return issues;
}

/**
 * 5. Photograph & Photo Plate Verification:
 * - Photo captions citing mismatched Vehicle Reg No / Asset ID
 * - Photo timestamp/date pre-dating loss or inconsistent with survey timeline
 * - Gap in photo numbering sequence (e.g. Photo 1, Photo 2, Photo 4 -> Photo 3 missing)
 */
export function checkPhotoPlateAndExhibitCorrelation(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  const regMatch = text.match(/\b(?:(?:vehicle\s*)?reg(?:istration)?\s*(?:no\.?|number|#)|chassis\s*(?:no\.?|number)|asset\s*(?:id|no\.?))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{5,25})\b/i);
  const primaryRegNo = regMatch ? regMatch[1].trim() : null;

  const lossDateMatch = text.match(/\b(?:date\s+of\s+(?:loss|accident|occurrence)|incident\s+date)\s*[:=–-]?\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/i);
  const parsedLossDate = lossDateMatch ? parseSurveyingDate(lossDateMatch[1]) : null;

  const photoPlateRegex = /\b(?:photo(?:graph)?(?:\s+plate)?)\s*(\d{1,3})\s*[:–-]\s*([^\n\r]+)/gi;
  let pMatch: RegExpExecArray | null;
  const detectedPhotos: { indexNum: number; rawSnippet: string; caption: string; offset: number; line: number }[] = [];

  while ((pMatch = photoPlateRegex.exec(text)) !== null) {
    const num = parseInt(pMatch[1], 10);
    const caption = pMatch[2].trim();
    detectedPhotos.push({
      indexNum: num,
      rawSnippet: pMatch[0],
      caption,
      offset: pMatch.index,
      line: getLineNumber(text, pMatch.index),
    });
  }

  // 1. Check for Photo Numbering Continuity (Missing or Skipped Photo Plates)
  if (detectedPhotos.length > 1) {
    const sorted = [...detectedPhotos].sort((a, b) => a.indexNum - b.indexNum);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].indexNum > sorted[i].indexNum + 1) {
        const missingNum = sorted[i].indexNum + 1;
        issues.push({
          id: `surv-photo-gap-${idCounter++}`,
          category: 'data-continuity',
          severity: 'warning',
          title: `Missing Photo Plate in Sequence (Photo ${missingNum})`,
          description: `Photographic evidence skips from Photo ${sorted[i].indexNum} (line ${sorted[i].line}) to Photo ${sorted[i + 1].indexNum} (line ${sorted[i + 1].line}). Photo ${missingNum} is missing or omitted from the photo sheet.`,
          originalText: sorted[i + 1].rawSnippet,
          suggestedText: sorted[i + 1].rawSnippet,
          startOffset: sorted[i + 1].offset,
          endOffset: sorted[i + 1].offset + sorted[i + 1].rawSnippet.length,
          lineNumber: sorted[i + 1].line,
          ruleId: 'photo-plate-sequence-gap',
          autoApplicable: false,
          explanation: `Surveying photo albums must maintain continuous numbering so insurers can confirm no damaged parts or negative photos were selectively excised.`,
        });
      }
    }
  }

  // 2. Check Photo Captions for Material Particular Discrepancies
  for (const photo of detectedPhotos) {
    // A. Registration No mismatch in Photo Caption
    if (primaryRegNo) {
      const regInCaption = photo.caption.match(/\b([A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{1,4})\b/i);
      if (regInCaption) {
        const foundReg = regInCaption[1].replace(/[\s-]/g, '').toUpperCase();
        const cleanPrimary = primaryRegNo.replace(/[\s-]/g, '').toUpperCase();
        if (foundReg !== cleanPrimary && foundReg.length >= 6) {
          issues.push({
            id: `surv-photo-reg-mismatch-${idCounter++}`,
            category: 'data-continuity',
            severity: 'critical',
            title: `Photo Caption Vehicle Reg No Mismatch (${regInCaption[1]})`,
            description: `Photo ${photo.indexNum} caption cites vehicle "${regInCaption[1]}" on line ${photo.line}, which does not match the report's declared insured vehicle ("${primaryRegNo}"). Check whether a photo from a different survey was accidentally attached.`,
            originalText: photo.rawSnippet,
            suggestedText: photo.rawSnippet.replace(regInCaption[1], primaryRegNo),
            startOffset: photo.offset,
            endOffset: photo.offset + photo.rawSnippet.length,
            lineNumber: photo.line,
            ruleId: 'photo-reg-no-mismatch',
            autoApplicable: true,
            explanation: `Attaching photos of an unrelated vehicle or registration plate is a critical error in loss adjusting and can trigger fraud audits.`,
          });
        }
      }
    }

    // B. Date of photo pre-dating Date of Loss
    if (parsedLossDate) {
      const dateInPhoto = photo.caption.match(/\b(?:taken\s+on|dated|on)\s*([0-9A-Za-z\s,\/\.\-]{6,25}\b(?:\d{4}))/i);
      if (dateInPhoto) {
        const parsedPhotoDate = parseSurveyingDate(dateInPhoto[1]);
        if (parsedPhotoDate && parsedPhotoDate.timestamp < parsedLossDate.timestamp) {
          issues.push({
            id: `surv-photo-predates-loss-${idCounter++}`,
            category: 'data-continuity',
            severity: 'critical',
            title: `Photo Timestamp Pre-dates Loss Date (${dateInPhoto[1]})`,
            description: `Photo ${photo.indexNum} is noted as taken on "${dateInPhoto[1]}" (line ${photo.line}), which is BEFORE the Date of Loss ("${lossDateMatch![1]}"). Evidence photos cannot precede the occurrence of casualty.`,
            originalText: photo.rawSnippet,
            suggestedText: photo.rawSnippet,
            startOffset: photo.offset,
            endOffset: photo.offset + photo.rawSnippet.length,
            lineNumber: photo.line,
            ruleId: 'photo-predates-loss-date',
            autoApplicable: false,
            explanation: `Inspections and physical evidence photos must be captured on or after the casualty occurrence date.`,
          });
        }
      }
    }
  }

  return issues;
}

