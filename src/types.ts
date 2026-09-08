export type QACategory = 
  | 'grammar' 
  | 'data-continuity' 
  | 'uniformity' 
  | 'placeholder' 
  | 'typography';

export type QASeverity = 'critical' | 'warning' | 'suggestion';

export interface QAIssue {
  id: string;
  category: QACategory;
  severity: QASeverity;
  title: string;
  description: string;
  originalText: string;
  suggestedText: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  ruleId: string;
  autoApplicable: boolean;
  ignored?: boolean;
  applied?: boolean;
  contextSnippet?: string;
  explanation?: string;
  isAiGenerated?: boolean;
  aiConfidence?: number;
}

export interface AISuggestionOption {
  label: string;
  replacementText: string;
  reason: string;
}

export interface AIExecutiveSummaryResult {
  executiveOverview: string;
  keyFindings: string[];
  riskFlags: string[];
  dataQualityScore: number;
  recommendations: string[];
}

export interface ReadabilityMetrics {
  fleschKincaidScore: number;
  readingEase: string;
  averageSentenceLength: number;
  averageWordSyllables: number;
  passiveVoicePercentage: number;
}

export interface MetricOccurrence {
  value: string;
  numericValue: number | null;
  unit?: string;
  rawSnippet: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  sectionContext?: string;
}

export interface ExtractedMetric {
  id: string;
  normalizedName: string;
  displayName: string;
  occurrences: MetricOccurrence[];
  status: 'consistent' | 'conflicting' | 'stale_copy' | 'template_default' | 'single';
  discrepancySummary?: string;
}

export interface DataContinuityStats {
  numbersChecked: number;
  inconsistenciesDetected: number;
  currenciesFound: string[];
  unitsFound: string[];
  datesFound: string[];
  tablesReferenced: string[];
  tablesDefined: string[];
  repeatedMetricsChecked: number;
  conflictingMetricsFound: number;
  staleCopiedDataFound: number;
  unchangedDefaultsFound: number;
}

export interface ReportStats {
  wordCount: number;
  charCount: number;
  sentenceCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
  qualityScore: number; // 0 - 100
  readability: ReadabilityMetrics;
  continuity: DataContinuityStats;
  extractedMetrics?: ExtractedMetric[];
}

export interface RuleConfig {
  checkGrammar: boolean;
  checkDataContinuity: boolean;
  checkRepetitiveData: boolean;
  checkStaleCopyPaste: boolean;
  checkUniformity: boolean;
  checkPlaceholders: boolean;
  checkPunctuation: boolean;
  strictNumberValidation: boolean;
  currencyConsistency: boolean;
  unitConsistency: boolean;
  deepScan?: boolean;
}

export interface SampleReport {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
}

export interface RecentFileRecord {
  id: string;
  filename: string;
  content: string;
  lastWorkedAt: number;
  sizeBytes: number;
  wordCount: number;
  qualityScore: number;
  issuesCount: number;
  resolvedCount: number;
  summaryTitle: string;
  format?: string;
  headerText?: string;
  footerText?: string;
}

export interface AutoSaveDraft {
  content: string;
  filename: string;
  timestamp: number;
  sessionResolvedCount: number;
  sessionBaselineTotal: number;
  headerText?: string;
  footerText?: string;
}

export interface DocumentHeaderFooter {
  headerText: string;
  footerText: string;
  isOriginal: boolean;
}
