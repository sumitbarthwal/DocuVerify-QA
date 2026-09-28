import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Calculator, 
  Calendar, 
  FileSpreadsheet, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  Check, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Table as TableIcon,
  Image as ImageIcon,
  Zap,
  ArrowRight
} from 'lucide-react';
import { ReportStats, QAIssue } from '../types';
import { TableCalculationAudit, DualExpressionPair } from '../services/advancedMathEngine';
import { TimelineEvent } from '../services/timelineIntelligence';
import { CitationAuditItem } from '../services/citationIntelligence';

interface DocumentIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ReportStats;
  issues: QAIssue[];
  onSelectIssue?: (issueId: string) => void;
  onApplyFix?: (issue: QAIssue) => void;
}

export const DocumentIntelligenceModal: React.FC<DocumentIntelligenceModalProps> = ({
  isOpen,
  onClose,
  stats,
  issues,
  onSelectIssue,
  onApplyFix,
}) => {
  const [activeTab, setActiveTab] = useState<'math' | 'timeline' | 'dual' | 'citations'>('math');

  if (!isOpen) return null;

  const tableAudits: TableCalculationAudit[] = stats.tableAudits || [];
  const timelineEvents: TimelineEvent[] = stats.timelineEvents || [];
  const dualPairs: DualExpressionPair[] = stats.dualPairs || [];
  const citationItems: CitationAuditItem[] = stats.citationItems || [];

  const mathMismatches = tableAudits.filter(t => t.status === 'mismatch');
  const timelineAnomalies = timelineEvents.filter(t => Boolean(t.anomaly));
  const dualMismatches = dualPairs.filter(d => !d.isMatch);
  const brokenCitations = citationItems.filter(c => c.status === 'missing_definition');

  const totalIntelligenceFlags = 
    mathMismatches.length + 
    timelineAnomalies.length + 
    dualMismatches.length + 
    brokenCitations.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Document Intelligence &amp; Precision Center</h2>
                {totalIntelligenceFlags === 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>All Checks Verified</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>{totalIntelligenceFlags} Discrepancies</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Deep mathematical auditing, chronological causality, and citation verification
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('math')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'math'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4 text-indigo-600" />
            <span>Table Arithmetic &amp; Sums</span>
            {mathMismatches.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                {mathMismatches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-purple-600" />
            <span>Timeline &amp; Causality</span>
            {timelineAnomalies.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                {timelineAnomalies.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('dual')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'dual'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Digits vs. Words</span>
            {dualMismatches.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                {dualMismatches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('citations')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'citations'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Cross-References &amp; Exhibits</span>
            {brokenCitations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                {brokenCitations.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Canvas */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-slate-700 bg-slate-50/50">
          
          {/* TAB 1: TABLE ARITHMETIC */}
          {activeTab === 'math' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span>Automated Column Summation &amp; Arithmetic Engine</span>
                  </h4>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    Inspects each table, recalculates line items, and compares computed totals with reported figures.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-indigo-900">
                    {tableAudits.length} Columns Checked
                  </span>
                  <span className="block text-[10px] text-indigo-600">
                    {mathMismatches.length > 0 ? `${mathMismatches.length} Mismatches` : 'All 100% Mathematically Correct'}
                  </span>
                </div>
              </div>

              {tableAudits.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
                  <TableIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No tabular calculations detected</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When you include markdown tables with itemized amounts and a "Total" row, mathematical checks will run automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tableAudits.map((item, idx) => {
                    const isErr = item.status === 'mismatch';
                    const curr = item.currencySymbol || '$';
                    return (
                      <div 
                        key={idx}
                        className={`p-4 rounded-xl border transition ${
                          isErr 
                            ? 'bg-rose-50/80 border-rose-200' 
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{item.tableName}</span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="text-slate-600 font-semibold">{item.columnName}</span>
                              <span className="text-[10px] text-slate-400">Line {item.lineNumber}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reported in Text</span>
                                <span className="font-mono font-bold text-slate-800">{item.rawTotalCell}</span>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 mt-2" />
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Calculated Sum</span>
                                <span className={`font-mono font-bold ${isErr ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {item.suggestedTotalCell}
                                </span>
                              </div>
                              {isErr && (
                                <div className="pl-3 border-l border-rose-200">
                                  <span className="text-[10px] uppercase font-bold text-rose-500 block">Variance</span>
                                  <span className="font-mono font-bold text-rose-700">
                                    {curr}{(item.reportedSum - item.calculatedSum).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            {isErr ? (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Math Mismatch</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Accurate Sum</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TIMELINE & CAUSALITY */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-purple-950 text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>Chronological Causality &amp; Milestones Matrix</span>
                  </h4>
                  <p className="text-[11px] text-purple-800 mt-0.5">
                    Verifies that incident, police, survey, and report dates obey logical real-world sequence.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-purple-900">
                    {timelineEvents.length} Milestone Dates Detected
                  </span>
                  <span className="block text-[10px] text-purple-600">
                    {timelineAnomalies.length > 0 ? `${timelineAnomalies.length} Causality Inconsistencies` : 'Strict Causality Verified'}
                  </span>
                </div>
              </div>

              {timelineEvents.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No milestone dates found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Label your dates (e.g., "Date of Loss: 12-Oct-2023", "Date of Survey: 14-Oct-2023") to map timeline causality.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {timelineEvents.map((evt, idx) => {
                    const isAnomaly = Boolean(evt.anomaly);
                    return (
                      <div key={idx} className="relative">
                        <div 
                          className={`absolute -left-6 top-2 w-3.5 h-3.5 rounded-full border-2 bg-white flex items-center justify-center ${
                            isAnomaly ? 'border-rose-500 bg-rose-500' : 'border-purple-600'
                          }`}
                        />
                        <div className={`p-3.5 rounded-xl border ${isAnomaly ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-xs">{evt.label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Line {evt.lineNumber}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono font-semibold text-purple-900 text-xs bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {evt.rawDateStr}
                            </span>
                            {evt.dateObj && (
                              <span className="text-[11px] text-slate-500">
                                ({evt.dateObj.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })})
                              </span>
                            )}
                          </div>
                          {isAnomaly && (
                            <div className="mt-2 p-2 bg-rose-100/70 border border-rose-200 rounded text-rose-800 text-[11px] font-semibold flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>{evt.anomaly}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIGITS VS WORDS */}
          {activeTab === 'dual' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Dual Numerical Expression Verification</span>
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Ensures numbers expressed in digits match their written words in parentheses (e.g. legal contracts, settlements).
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-emerald-900">
                    {dualPairs.length} Dual Expressions Checked
                  </span>
                  <span className="block text-[10px] text-emerald-600">
                    {dualMismatches.length > 0 ? `${dualMismatches.length} Mismatches` : 'All 100% In Agreement'}
                  </span>
                </div>
              </div>

              {dualPairs.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No dual-expressed figures found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When writing amounts like "$50,000 (Fifty Thousand Dollars)", this scanner ensures the words and numbers match exactly.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dualPairs.map((pair, idx) => {
                    const isErr = !pair.isMatch;
                    return (
                      <div 
                        key={idx}
                        className={`p-4 rounded-xl border ${
                          isErr ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-slate-800 text-xs font-semibold block">
                              {pair.rawText}
                            </span>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Digits Value</span>
                                <span className="font-mono font-bold text-slate-900">{pair.numericVal.toLocaleString()}</span>
                              </div>
                              <span className="text-slate-300 font-bold">vs</span>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Written Words Value</span>
                                <span className={`font-mono font-bold ${isErr ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {pair.wordsVal.toLocaleString()}
                                </span>
                              </div>
                              {isErr && (
                                <div className="pl-3 border-l border-rose-200">
                                  <span className="text-[10px] uppercase font-bold text-rose-500 block">Discrepancy</span>
                                  <span className="font-mono font-bold text-rose-700">
                                    {Math.abs(pair.difference).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            {isErr ? (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Mismatch</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Consistent</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CITATIONS & EXHIBITS */}
          {activeTab === 'citations' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Cross-Reference &amp; Exhibit Resolution Matrix</span>
                  </h4>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Ensures every referenced Table, Photo Plate, Annexure, and Exhibit exists in the document.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-blue-900">
                    {citationItems.length} Citations Tracked
                  </span>
                  <span className="block text-[10px] text-blue-600">
                    {brokenCitations.length > 0 ? `${brokenCitations.length} Broken Citations` : 'All Cross-References Resolved'}
                  </span>
                </div>
              </div>

              {citationItems.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No cross-reference citations detected</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Citations like "Refer to Table 2" or "See Photo Plate 3" are tracked here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {citationItems.map((item, idx) => {
                    const isMissing = item.status === 'missing_definition';
                    return (
                      <div 
                        key={idx}
                        className={`p-3.5 rounded-xl border flex items-center justify-between ${
                          isMissing ? 'bg-amber-50/80 border-amber-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            item.type === 'photo' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.type === 'photo' ? <ImageIcon className="w-4 h-4" /> : <TableIcon className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs">{item.refIdentifier}</span>
                              {item.citationLineNumber && (
                                <span className="text-[10px] text-slate-400">Cited at line {item.citationLineNumber}</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-600 block mt-0.5">{item.summary}</span>
                          </div>
                        </div>

                        <div>
                          {isMissing ? (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Missing in Body</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px] flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Verified Target</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Deterministic Math &bull; Chronological Causality &bull; Citation Resolution Engine Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
