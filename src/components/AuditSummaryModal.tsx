import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  FileText, 
  X, 
  Download, 
  Percent, 
  Clock, 
  BookOpen, 
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { ReportStats, QAIssue, AIExecutiveSummaryResult } from '../types';
import { generateAIExecutiveSummary } from '../services/aiAuditService';

interface AuditSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ReportStats;
  issues: QAIssue[];
  filename: string;
  onPrintCertificate: () => void;
  onExportWord: () => void;
  onSelectIssue?: (issueId: string) => void;
  content?: string;
}

export const AuditSummaryModal: React.FC<AuditSummaryModalProps> = ({
  isOpen,
  onClose,
  stats,
  issues,
  filename,
  onPrintCertificate,
  onExportWord,
  onSelectIssue,
  content,
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | 'all'>('all');
  const [aiBriefLoading, setAiBriefLoading] = useState<boolean>(false);
  const [aiBrief, setAiBrief] = useState<AIExecutiveSummaryResult | null>(null);
  const [aiBriefError, setAiBriefError] = useState<string | null>(null);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);

  if (!isOpen) return null;

  const activeIssues = issues.filter(i => !i.applied && !i.ignored);
  const criticalPending = activeIssues.filter(i => i.severity === 'critical');
  const warningsPending = activeIssues.filter(i => i.severity === 'warning');
  const isPassed = criticalPending.length === 0;

  const displayedIssues = activeIssues.filter(issue => {
    if (activeCategoryFilter === 'all') return true;
    if (activeCategoryFilter === 'grammar' && (issue.category === 'grammar' || issue.category === 'typography')) return true;
    return issue.category === activeCategoryFilter;
  });

  const handleJumpToIssue = (issueId: string) => {
    if (onSelectIssue) {
      onSelectIssue(issueId);
    }
    onClose();
  };

  const handleGenerateAIBrief = async () => {
    if (!content) return;
    setAiBriefLoading(true);
    setAiBriefError(null);
    try {
      const res = await generateAIExecutiveSummary(content, filename, activeIssues.length, stats.qualityScore);
      if (res.success && res.summary) {
        setAiBrief(res.summary);
      } else {
        setAiBriefError(res.error || 'Failed to generate executive summary');
      }
    } catch (err: any) {
      setAiBriefError(err.message || 'Error communicating with AI service');
    } finally {
      setAiBriefLoading(false);
    }
  };

  const handleCopyBrief = () => {
    if (!aiBrief) return;
    const text = `EXECUTIVE AUDIT BRIEF: ${filename}
Score: ${aiBrief.dataQualityScore || stats.qualityScore}/100

OVERVIEW:
${aiBrief.executiveOverview}

KEY FINDINGS:
${aiBrief.keyFindings?.map((f, i) => `${i + 1}. ${f}`).join('\n') || 'None'}

RISK FLAGS:
${aiBrief.riskFlags?.map((r, i) => `- ${r}`).join('\n') || 'None'}

RECOMMENDATIONS:
${aiBrief.recommendations?.map((rec, i) => `• ${rec}`).join('\n') || 'None'}`;

    navigator.clipboard.writeText(text);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${
              isPassed ? 'bg-emerald-600' : 'bg-amber-600'
            }`}>
              {isPassed ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Quality Assurance Audit Scorecard</h3>
              <p className="text-xs text-slate-500">Document: {filename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600">
          {/* Top Score Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isPassed ? '✓ Ready for Executive Sign-off' : '⚠ Action Items Require Attention'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 max-w-md">
                {isPassed 
                  ? 'All critical numerical continuity, formula sums, and grammar defects have been resolved.'
                  : `${criticalPending.length} critical defect(s) and ${warningsPending.length} warning(s) remaining in document.`}
              </p>
            </div>

            <div className="text-center sm:text-right shrink-0">
              <div className="text-3xl font-extrabold text-slate-900">{stats.qualityScore}<span className="text-sm font-normal text-slate-400">/100</span></div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Automated QA Integrity Index</div>
            </div>
          </div>

          {/* AI Executive Brief Section */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>Executive AI Audit Brief</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-semibold">Gemini 3.8 Flash</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    High-level syntheses for underwriters, surveyors, and lead partners
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {aiBrief && (
                  <button
                    onClick={handleCopyBrief}
                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-md hover:bg-indigo-50 transition flex items-center gap-1 cursor-pointer"
                  >
                    {copiedBrief ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBrief ? 'Copied' : 'Copy Brief'}</span>
                  </button>
                )}
                <button
                  onClick={handleGenerateAIBrief}
                  disabled={aiBriefLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {aiBriefLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{aiBrief ? 'Regenerate Brief' : 'Generate AI Brief'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {aiBriefError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {aiBriefError}
              </div>
            )}

            {aiBrief && (
              <div className="p-3 bg-white border border-indigo-100 rounded-lg space-y-2.5 text-xs text-slate-700">
                <div>
                  <span className="font-bold text-indigo-900 block mb-0.5">Overview:</span>
                  <p className="leading-relaxed text-slate-600">{aiBrief.executiveOverview}</p>
                </div>

                {aiBrief.keyFindings && aiBrief.keyFindings.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-900 block mb-1">Key Technical & Financial Findings:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                      {aiBrief.keyFindings.map((f, idx) => (
                        <li key={idx} className="leading-snug">{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiBrief.riskFlags && aiBrief.riskFlags.length > 0 && (
                  <div>
                    <span className="font-bold text-amber-900 block mb-1">Identified Risk Flags:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-800 pl-1 bg-amber-50/60 p-2 rounded border border-amber-200/80">
                      {aiBrief.riskFlags.map((r, idx) => (
                        <li key={idx} className="leading-snug">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiBrief.recommendations && aiBrief.recommendations.length > 0 && (
                  <div>
                    <span className="font-bold text-emerald-900 block mb-1">Recommended Action Items:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                      {aiBrief.recommendations.map((rec, idx) => (
                        <li key={idx} className="leading-snug">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detailed Verification Checklist */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span>QA Category Breakdown (Click to filter list below)</span>
            </h4>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
              <div 
                onClick={() => setActiveCategoryFilter(activeCategoryFilter === 'data-continuity' ? 'all' : 'data-continuity')}
                className={`p-3 flex items-center justify-between transition cursor-pointer ${
                  activeCategoryFilter === 'data-continuity' ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Mathematical &amp; Data Continuity</span>
                    <span className="text-[10px] text-slate-400 font-normal">(dates, amounts, entities, notes)</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">Percentage sums, policy numbers, chronological survey dates, assessment tables</div>
                </div>
                <div>
                  {issues.filter(i => i.category === 'data-continuity' && !i.applied && !i.ignored).length === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Passed (0 Errors)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {issues.filter(i => i.category === 'data-continuity' && !i.applied && !i.ignored).length} Discrepancies
                    </span>
                  )}
                </div>
              </div>

              <div 
                onClick={() => setActiveCategoryFilter(activeCategoryFilter === 'grammar' ? 'all' : 'grammar')}
                className={`p-3 flex items-center justify-between transition cursor-pointer ${
                  activeCategoryFilter === 'grammar' ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Grammar, Syntax &amp; Repeated Words</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">Subject-verb agreement, typos, double words, homophone confusion</div>
                </div>
                <div>
                  {issues.filter(i => (i.category === 'grammar' || i.category === 'typography') && !i.applied && !i.ignored).length === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Clean (0 Issues)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {issues.filter(i => (i.category === 'grammar' || i.category === 'typography') && !i.applied && !i.ignored).length} Unresolved
                    </span>
                  )}
                </div>
              </div>

              <div 
                onClick={() => setActiveCategoryFilter(activeCategoryFilter === 'placeholder' ? 'all' : 'placeholder')}
                className={`p-3 flex items-center justify-between transition cursor-pointer ${
                  activeCategoryFilter === 'placeholder' ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Draft &amp; Placeholder Purge</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">Inspection for [TODO], [TBD], [INSERT], and scaffold text</div>
                </div>
                <div>
                  {issues.filter(i => i.category === 'placeholder' && !i.applied && !i.ignored).length === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Purged (0 Left)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {issues.filter(i => i.category === 'placeholder' && !i.applied && !i.ignored).length} Draft Tags
                    </span>
                  )}
                </div>
              </div>

              <div 
                onClick={() => setActiveCategoryFilter(activeCategoryFilter === 'uniformity' ? 'all' : 'uniformity')}
                className={`p-3 flex items-center justify-between transition cursor-pointer ${
                  activeCategoryFilter === 'uniformity' ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Uniformity, Units &amp; Currency Notation</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">ISO 8601 vs local dates, currency symbol placement, Oxford comma consistency</div>
                </div>
                <div>
                  {issues.filter(i => i.category === 'uniformity' && !i.applied && !i.ignored).length === 0 ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Standardized
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {issues.filter(i => i.category === 'uniformity' && !i.applied && !i.ignored).length} Inconsistent
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Unresolved Items Drilldown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-500" />
                <span>
                  Unresolved Issues
                  {activeCategoryFilter !== 'all' && ` in ${activeCategoryFilter}`}
                </span>
              </h4>
              <span className="text-[11px] text-slate-500 font-semibold">
                {displayedIssues.length} item{displayedIssues.length === 1 ? '' : 's'}
              </span>
            </div>

            {displayedIssues.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <div className="font-bold text-emerald-900 text-xs">No unresolved issues in this category</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">Everything adheres to QA guidelines.</div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {displayedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    onClick={() => handleJumpToIssue(issue.id)}
                    className="p-3 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-400 rounded-xl transition cursor-pointer shadow-2xs group flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          issue.severity === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">Line {issue.lineNumber}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] font-semibold text-slate-700">{issue.title}</span>
                      </div>
                      <span className="text-xs text-blue-600 font-bold group-hover:translate-x-0.5 transition flex items-center gap-1 shrink-0">
                        <span>Jump to line</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pl-0.5">
                      {issue.description}
                    </p>

                    {issue.originalText && (
                      <div className="mt-1 flex items-center gap-2 text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-200/80 font-mono">
                        <span className="text-slate-400">Snippet:</span>
                        <span className="text-rose-700 bg-rose-50 px-1 py-0.2 rounded font-semibold truncate max-w-xs">{issue.originalText}</span>
                        {issue.suggestedText && issue.suggestedText !== issue.originalText && (
                          <>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-semibold truncate max-w-xs">{issue.suggestedText}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onPrintCertificate}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Official QA Certificate</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onExportWord();
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Final Report (.doc)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
