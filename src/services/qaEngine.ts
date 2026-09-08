import { QAIssue, ReportStats, QACategory, RuleConfig, ExtractedMetric } from '../types';
import { detectGrammarAndPunctuationIssues } from './grammarRules';
import { checkDataContinuity } from './dataContinuityRules';
import { checkUniformityAndPlaceholders } from './uniformityRules';
import { checkRepetitiveAndUnchangedData } from './repetitiveDataRules';
import { 
  checkSurveyingDateSequence, 
  checkSurveyingIdentifiers, 
  checkAssessmentTableVsNotes,
  checkUnlinkedMaterialParticulars,
  checkPhotoPlateAndExhibitCorrelation
} from './surveyingRules';
import { performDeepTableTextCrossScan } from './deepScanService';

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  checkGrammar: true,
  checkDataContinuity: true,
  checkRepetitiveData: true,
  checkStaleCopyPaste: true,
  checkUniformity: true,
  checkPlaceholders: true,
  checkPunctuation: true,
  strictNumberValidation: true,
  currencyConsistency: true,
  unitConsistency: true,
  deepScan: false,
};

export function runFullDocumentQA(text: string, config: RuleConfig = DEFAULT_RULE_CONFIG): {
  issues: QAIssue[];
  stats: ReportStats;
} {
  if (!text || text.trim().length === 0) {
    return {
      issues: [],
      stats: getEmptyStats(),
    };
  }

  const allIssues: QAIssue[] = [];

  // 1. Grammar & Punctuation
  if (config.checkGrammar || config.checkPunctuation) {
    const grammarIssues = detectGrammarAndPunctuationIssues(text);
    const filtered = grammarIssues.filter(iss => {
      if (!config.checkGrammar && iss.category === 'grammar') return false;
      if (!config.checkPunctuation && iss.category === 'typography') return false;
      return true;
    });
    allIssues.push(...filtered);
  }

  // 2. Data Continuity & Integrity
  let continuityStats = {
    numbersChecked: 0,
    inconsistenciesDetected: 0,
    currenciesFound: [] as string[],
    unitsFound: [] as string[],
    datesFound: [] as string[],
    tablesReferenced: [] as string[],
    tablesDefined: [] as string[],
    repeatedMetricsChecked: 0,
    conflictingMetricsFound: 0,
    staleCopiedDataFound: 0,
    unchangedDefaultsFound: 0,
  };

  if (config.checkDataContinuity) {
    const continuityResult = checkDataContinuity(text);
    allIssues.push(...continuityResult.issues);
    continuityStats = {
      ...continuityStats,
      ...continuityResult.stats,
    };
  }

  // 3. Repetitive Data & Stale Copy-Paste Analysis
  let extractedMetrics: ExtractedMetric[] = [];
  if (config.checkDataContinuity && (config.checkRepetitiveData || config.checkStaleCopyPaste)) {
    const repResult = checkRepetitiveAndUnchangedData(text, config);
    allIssues.push(...repResult.issues);
    extractedMetrics = repResult.extractedMetrics;
    continuityStats.repeatedMetricsChecked += repResult.stats.repeatedMetricsChecked;
    continuityStats.conflictingMetricsFound += repResult.stats.conflictingMetricsFound;
    continuityStats.staleCopiedDataFound += repResult.stats.staleCopiedDataFound;
    continuityStats.unchangedDefaultsFound += repResult.stats.unchangedDefaultsFound;
  }

  // 4. Surveying & Loss Assessment Domain Logic:
  // - Workflow sequence: Loss <= Intimation <= Survey <= Re-inspection <= Assessment Sharing <= Consent
  // - Identifier consistency: Stale/conflicting Policy No, Claim No, Reg No
  // - Assessment Table vs Notes: Salvage, Depreciation, Excess, Net Liability
  // - Material particulars: Unlinked Insured company names, location divergence, unlinked annexures
  // - Photo plates & exhibits: Caption Reg No mismatch, date pre-dating loss, missing plate sequence
  if (config.checkDataContinuity) {
    const surveyingDateIssues = checkSurveyingDateSequence(text);
    const identifierIssues = checkSurveyingIdentifiers(text);
    const tableVsNotesIssues = checkAssessmentTableVsNotes(text);
    const unlinkedPartIssues = checkUnlinkedMaterialParticulars(text);
    const photoPlateIssues = checkPhotoPlateAndExhibitCorrelation(text);
    
    allIssues.push(
      ...surveyingDateIssues, 
      ...identifierIssues, 
      ...tableVsNotesIssues,
      ...unlinkedPartIssues,
      ...photoPlateIssues
    );
    continuityStats.inconsistenciesDetected += (
      surveyingDateIssues.length + 
      identifierIssues.length + 
      tableVsNotesIssues.length +
      unlinkedPartIssues.length +
      photoPlateIssues.length
    );
  }

  // 5. Deep Scan: Rigorous Cross-Referencing Between Tables and Text Blocks
  if (config.deepScan) {
    const deepScanIssues = performDeepTableTextCrossScan(text);
    allIssues.push(...deepScanIssues);
    continuityStats.inconsistenciesDetected += deepScanIssues.length;
  }

  // 6. Uniformity & Placeholders
  if (config.checkUniformity || config.checkPlaceholders) {
    const uniformityIssues = checkUniformityAndPlaceholders(text);
    const filtered = uniformityIssues.filter(iss => {
      if (!config.checkPlaceholders && iss.category === 'placeholder') return false;
      if (!config.checkUniformity && iss.category === 'uniformity') return false;
      return true;
    });
    allIssues.push(...filtered);
  }

  // Deduplicate overlapping issues (keep the most specific / severe)
  const sortedIssues = allIssues.sort((a, b) => a.startOffset - b.startOffset);

  // Compute stats and quality score
  const stats = calculateReportStats(text, sortedIssues, continuityStats, extractedMetrics);

  return {
    issues: sortedIssues,
    stats,
  };
}

function calculateReportStats(
  text: string, 
  issues: QAIssue[], 
  continuityStats: any,
  extractedMetrics: ExtractedMetric[] = []
): ReportStats {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const charCount = text.length;

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphCount = Math.max(1, paragraphs.length);

  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  // Syllable calculation for Flesch-Kincaid
  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }
  const avgSentenceLength = wordCount / sentenceCount;
  const avgWordSyllables = wordCount > 0 ? totalSyllables / wordCount : 1;

  // Flesch Reading Ease formula: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  let flesch = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgWordSyllables);
  flesch = Math.max(0, Math.min(100, Math.round(flesch)));

  let readingEase = 'Standard';
  if (flesch >= 90) readingEase = 'Very Easy';
  else if (flesch >= 80) readingEase = 'Easy';
  else if (flesch >= 70) readingEase = 'Fairly Easy';
  else if (flesch >= 60) readingEase = 'Standard / Professional';
  else if (flesch >= 50) readingEase = 'Fairly Difficult';
  else if (flesch >= 30) readingEase = 'Difficult / Academic';
  else readingEase = 'Very Confusing / Dense';

  // Passive voice count heuristic
  const passiveMatches = text.match(/\b(is|are|was|were|been|being|be)\s+([a-z]{3,}ed)\b/gi) || [];
  const passivePercentage = Math.min(100, Math.round((passiveMatches.length / sentenceCount) * 100));

  // Overall Quality Score (0 to 100)
  // Deductions: Critical (-8), Warning (-4), Suggestion (-1.5) per 500 words
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const suggestionCount = issues.filter(i => i.severity === 'suggestion').length;

  const normalizedScale = Math.max(1, wordCount / 400);
  const totalDeductions = ((criticalCount * 12) + (warningCount * 5) + (suggestionCount * 2)) / normalizedScale;
  const qualityScore = Math.max(10, Math.min(100, Math.round(100 - totalDeductions)));

  return {
    wordCount,
    charCount,
    sentenceCount,
    paragraphCount,
    readingTimeMinutes,
    qualityScore,
    readability: {
      fleschKincaidScore: flesch,
      readingEase,
      averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      averageWordSyllables: Math.round(avgWordSyllables * 10) / 10,
      passiveVoicePercentage: passivePercentage,
    },
    continuity: {
      ...continuityStats,
      inconsistenciesDetected: issues.filter(i => i.category === 'data-continuity').length,
    },
    extractedMetrics,
  };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function getEmptyStats(): ReportStats {
  return {
    wordCount: 0,
    charCount: 0,
    sentenceCount: 0,
    paragraphCount: 0,
    readingTimeMinutes: 0,
    qualityScore: 100,
    readability: {
      fleschKincaidScore: 100,
      readingEase: 'N/A',
      averageSentenceLength: 0,
      averageWordSyllables: 0,
      passiveVoicePercentage: 0,
    },
    continuity: {
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
    },
    extractedMetrics: [],
  };
}

/**
 * Apply a single fix cleanly to text
 */
export function applySingleFix(text: string, issue: QAIssue): string {
  // If start and end are valid and text matches
  if (issue.startOffset >= 0 && issue.endOffset <= text.length) {
    const currentSlice = text.slice(issue.startOffset, issue.endOffset);
    if (currentSlice === issue.originalText) {
      return text.slice(0, issue.startOffset) + issue.suggestedText + text.slice(issue.endOffset);
    }
  }

  // Fallback: replace first occurrence of originalText near offset
  const index = text.indexOf(issue.originalText, Math.max(0, issue.startOffset - 30));
  if (index !== -1) {
    return text.slice(0, index) + issue.suggestedText + text.slice(index + issue.originalText.length);
  }

  // Last resort global replace first match
  return text.replace(issue.originalText, issue.suggestedText);
}

/**
 * Apply all auto-applicable verified fixes sequentially from bottom to top
 * (Reversed offset order ensures subsequent replacements do NOT shift prior positions)
 */
export function applyAllVerifiedFixes(text: string, issues: QAIssue[]): { 
  updatedText: string; 
  appliedCount: number;
  replacements: Array<{ oldText: string; newText: string }>;
} {
  // Filter for autoApplicable and not ignored
  const applicable = issues.filter(iss => iss.autoApplicable && !iss.ignored && iss.suggestedText !== iss.originalText);
  
  // Sort descending by startOffset so string mutations do not perturb earlier offsets
  const sortedDesc = [...applicable].sort((a, b) => b.startOffset - a.startOffset);

  let updatedText = text;
  let appliedCount = 0;
  const replacements: Array<{ oldText: string; newText: string }> = [];

  for (const issue of sortedDesc) {
    if (issue.startOffset >= 0 && issue.endOffset <= updatedText.length) {
      const slice = updatedText.slice(issue.startOffset, issue.endOffset);
      if (slice === issue.originalText) {
        updatedText = updatedText.slice(0, issue.startOffset) + issue.suggestedText + updatedText.slice(issue.endOffset);
        appliedCount++;
        replacements.push({ oldText: issue.originalText, newText: issue.suggestedText });
      } else {
        // Safe check if original text still exists at that exact position
        const localIdx = updatedText.indexOf(issue.originalText, Math.max(0, issue.startOffset - 20));
        if (localIdx !== -1) {
          updatedText = updatedText.slice(0, localIdx) + issue.suggestedText + updatedText.slice(localIdx + issue.originalText.length);
          appliedCount++;
          replacements.push({ oldText: issue.originalText, newText: issue.suggestedText });
        }
      }
    }
  }

  return { updatedText, appliedCount, replacements };
}

/**
 * Apply all fixes for a specific category
 */
export function applyCategoryFixes(
  text: string, 
  issues: QAIssue[], 
  category: QACategory
): { 
  updatedText: string; 
  appliedCount: number;
  replacements: Array<{ oldText: string; newText: string }>;
} {
  const categoryIssues = issues.filter(i => {
    const inCategory = category === 'grammar' 
      ? (i.category === 'grammar' || i.category === 'typography')
      : i.category === category;
    return inCategory && !i.ignored && i.suggestedText && i.suggestedText !== i.originalText;
  });

  // Sort descending by startOffset so string mutations do not perturb earlier offsets
  const sortedDesc = [...categoryIssues].sort((a, b) => b.startOffset - a.startOffset);
  let updatedText = text;
  let appliedCount = 0;
  const replacements: Array<{ oldText: string; newText: string }> = [];

  for (const issue of sortedDesc) {
    if (issue.startOffset >= 0 && issue.endOffset <= updatedText.length) {
      const slice = updatedText.slice(issue.startOffset, issue.endOffset);
      if (slice === issue.originalText) {
        updatedText = updatedText.slice(0, issue.startOffset) + issue.suggestedText + updatedText.slice(issue.endOffset);
        appliedCount++;
        replacements.push({ oldText: issue.originalText, newText: issue.suggestedText });
      } else {
        const localIdx = updatedText.indexOf(issue.originalText, Math.max(0, issue.startOffset - 25));
        if (localIdx !== -1) {
          updatedText = updatedText.slice(0, localIdx) + issue.suggestedText + updatedText.slice(localIdx + issue.originalText.length);
          appliedCount++;
          replacements.push({ oldText: issue.originalText, newText: issue.suggestedText });
        }
      }
    }
  }

  return { updatedText, appliedCount, replacements };
}
