import React, { useState } from 'react';
import { 
  Sparkles, 
  Check, 
  X, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  SlidersHorizontal, 
  ArrowRight,
  Target,
  ExternalLink,
  Layers,
  Search,
  Filter,
  Zap,
  Type,
  FileText,
  Loader2
} from 'lucide-react';
import { QAIssue, QACategory, QASeverity } from '../types';

interface QASidebarProps {
  issues: QAIssue[];
  onApplyIssue: (issue: QAIssue) => void;
  onIgnoreIssue: (issueId: string) => void;
  onApplyAllVerified: () => void;
  onApplyCategory: (category: QACategory) => void;
  selectedIssueId: string | null;
  onSelectIssue: (id: string | null) => void;
  resolvedCount?: number;
  totalIssuesCount?: number;
  resolvedPercentage?: number;
  deepScanActive?: boolean;
  onTriggerAiScan?: () => void;
  isAiScanning?: boolean;
  aiAvailable?: boolean;
}

export const QASidebar: React.FC<QASidebarProps> = ({
  issues,
  onApplyIssue,
  onIgnoreIssue,
  onApplyAllVerified,
  onApplyCategory,
  selectedIssueId,
  onSelectIssue,
  resolvedCount,
  totalIssuesCount,
  resolvedPercentage,
  deepScanActive,
  onTriggerAiScan,
  isAiScanning = false,
  aiAvailable = true,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<QACategory | 'all'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<QASeverity | 'all'>('all');

  // Filter out ignored or already applied
  const activeIssues = issues.filter(i => !i.ignored && !i.applied);

  // Filtered by category, severity, and search
  const displayedIssues = activeIssues.filter(issue => {
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'grammar' && (issue.category !== 'grammar' && issue.category !== 'typography')) return false;
      if (selectedCategory !== 'grammar' && issue.category !== selectedCategory) return false;
    }
    if (severityFilter !== 'all' && issue.severity !== severityFilter) {
      return false;
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchDesc = issue.description.toLowerCase().includes(q);
      const matchOrig = issue.originalText.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchOrig) return false;
    }
    return true;
  });

  const autoApplicableCount = activeIssues.filter(i => i.autoApplicable && i.suggestedText !== i.originalText).length;

  // Category counts and applicable items
  const dataContinuityIssues = activeIssues.filter(i => i.category === 'data-continuity');
  const grammarIssues = activeIssues.filter(i => i.category === 'grammar' || i.category === 'typography');
  const uniformityIssues = activeIssues.filter(i => i.category === 'uniformity');
  const placeholderIssues = activeIssues.filter(i => i.category === 'placeholder');

  const dataContinuityCount = dataContinuityIssues.length;
  const grammarCount = grammarIssues.length;
  const uniformityCount = uniformityIssues.length;
  const placeholderCount = placeholderIssues.length;

  const dataContinuityApplicable = dataContinuityIssues.filter(i => !i.ignored && i.suggestedText && i.suggestedText !== i.originalText).length;
  const grammarApplicable = grammarIssues.filter(i => !i.ignored && i.suggestedText && i.suggestedText !== i.originalText).length;
  const uniformityApplicable = uniformityIssues.filter(i => !i.ignored && i.suggestedText && i.suggestedText !== i.originalText).length;
  const placeholderApplicable = placeholderIssues.filter(i => !i.ignored && i.suggestedText && i.suggestedText !== i.originalText).length;

  // Displayed subsets
  const displayedDataContinuity = displayedIssues.filter(i => i.category === 'data-continuity');
  const displayedGrammar = displayedIssues.filter(i => i.category === 'grammar' || i.category === 'typography');
  const displayedUniformity = displayedIssues.filter(i => i.category === 'uniformity');
  const displayedPlaceholder = displayedIssues.filter(i => i.category === 'placeholder');

  // Compute resolved progress
  const computedTotal = totalIssuesCount ?? (activeIssues.length + (resolvedCount ?? 0));
  const computedResolved = resolvedCount ?? 0;
  const computedPercentage = resolvedPercentage ?? (
    computedTotal > 0 
      ? Math.min(100, Math.round((computedResolved / computedTotal) * 100))
      : (activeIssues.length === 0 ? 100 : 0)
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm tracking-tight">QA Verification Center</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {deepScanActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200/70" title="Deep Scan table & text cross-referencing active">
                <Zap className="w-3 h-3 text-indigo-600" /> Deep Scan
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
              {activeIssues.length} {activeIssues.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar Tracking Issues Resolved */}
        <div className="p-3 mb-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800">Audit Resolution Progress</span>
              {computedPercentage === 100 ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500">
                  {computedResolved} of {computedTotal} resolved
                </span>
              )}
            </div>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
              computedPercentage === 100 
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60' 
                : computedPercentage >= 50 
                ? 'text-blue-700 bg-blue-50 border border-blue-200/60' 
                : 'text-amber-700 bg-amber-50 border border-amber-200/60'
            }`}>
              {computedPercentage}%
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                computedPercentage === 100 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                  : computedPercentage >= 50 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                  : 'bg-gradient-to-r from-amber-400 to-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, computedPercentage))}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
            <span>
              {activeIssues.length === 0 
                ? 'All detected issues addressed' 
                : `${activeIssues.length} active issue${activeIssues.length === 1 ? '' : 's'} remaining`}
            </span>
            {autoApplicableCount > 0 && (
              <span className="text-blue-600 font-semibold">
                {autoApplicableCount} quick-fixable
              </span>
            )}
          </div>
        </div>

        {/* Master Auto-Apply Button */}
        {autoApplicableCount > 0 ? (
          <button
            id="btn-auto-apply-verified"
            onClick={onApplyAllVerified}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-[0.99]"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Auto-Apply All Verified Fixes ({autoApplicableCount})</span>
          </button>
        ) : (
          <div className="text-xs text-slate-500 py-1.5 flex items-center gap-1.5 justify-center bg-slate-100/80 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{activeIssues.length === 0 ? 'All checks verified clean' : 'Review manual items below'}</span>
          </div>
        )}

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-md font-medium shrink-0 transition ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            All ({activeIssues.length})
          </button>
          <button
            onClick={() => setSelectedCategory('data-continuity')}
            className={`px-2.5 py-1 rounded-md font-medium shrink-0 transition flex items-center gap-1 ${
              selectedCategory === 'data-continuity'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>Data Continuity</span>
            {dataContinuityCount > 0 && (
              <span className={`px-1 rounded-full text-[10px] font-bold ${
                selectedCategory === 'data-continuity' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'
              }`}>
                {dataContinuityCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedCategory('grammar')}
            className={`px-2.5 py-1 rounded-md font-medium shrink-0 transition flex items-center gap-1 ${
              selectedCategory === 'grammar'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>Grammar & Spell</span>
            {grammarCount > 0 && (
              <span className={`px-1 rounded-full text-[10px] font-bold ${
                selectedCategory === 'grammar' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {grammarCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedCategory('uniformity')}
            className={`px-2.5 py-1 rounded-md font-medium shrink-0 transition flex items-center gap-1 ${
              selectedCategory === 'uniformity'
                ? 'bg-purple-600 text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>Uniformity</span>
            {uniformityCount > 0 && (
              <span className={`px-1 rounded-full text-[10px] font-bold ${
                selectedCategory === 'uniformity' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-800'
              }`}>
                {uniformityCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedCategory('placeholder')}
            className={`px-2.5 py-1 rounded-md font-medium shrink-0 transition flex items-center gap-1 ${
              selectedCategory === 'placeholder'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>Placeholders</span>
            {placeholderCount > 0 && (
              <span className={`px-1 rounded-full text-[10px] font-bold ${
                selectedCategory === 'placeholder' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {placeholderCount}
              </span>
            )}
          </button>
        </div>

        {/* Search & Severity Filter */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter issue rules or text..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md pl-8 pr-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-blue-400"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 outline-hidden"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warnings</option>
            <option value="suggestion">Suggestions</option>
          </select>
        </div>
      </div>

      {/* Issues List Container */}
      <div className="flex-1 p-3 overflow-y-auto space-y-4 bg-slate-50/40">
        {/* Optional Online AI Extended Deep Scan Card */}
        {onTriggerAiScan && (
          <div className="p-3 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white shadow-xs">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-xs text-indigo-950">AI Extended Deep Scan</h4>
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded font-semibold">
                      Gemini 3.8 Flash
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800/80 mt-0.5 leading-snug">
                    Deep semantic pass for contextual errors, conflicting figures, and professional tone.
                  </p>
                </div>
              </div>
              <button
                onClick={onTriggerAiScan}
                disabled={isAiScanning}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0 transition disabled:opacity-50 cursor-pointer"
                title="Run Gemini Extended Audit"
              >
                {isAiScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Auditing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Scan Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {displayedIssues.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">
              {activeIssues.length === 0 ? 'Zero Defects Detected!' : 'No matching issues'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {activeIssues.length === 0 
                ? 'Your document has passed all automated grammar, data continuity, arithmetic, and uniformity checks.' 
                : 'Try adjusting your category or search filter above.'}
            </p>
          </div>
        ) : selectedCategory !== 'all' ? (
          /* Single Category View with Prominent Category Batch Action */
          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-xs text-slate-900 capitalize">
                  {selectedCategory === 'data-continuity' ? 'Data Continuity & Cross-Verification' :
                   selectedCategory === 'grammar' ? 'Grammar, Spelling & Syntax' :
                   selectedCategory === 'uniformity' ? 'Uniformity & Notation Formatting' :
                   'Draft Placeholders & Leaks'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {displayedIssues.length} active issue{displayedIssues.length === 1 ? '' : 's'} in category
                </div>
              </div>
              {((selectedCategory === 'data-continuity' && dataContinuityApplicable > 0) ||
                (selectedCategory === 'grammar' && grammarApplicable > 0) ||
                (selectedCategory === 'uniformity' && uniformityApplicable > 0) ||
                (selectedCategory === 'placeholder' && placeholderApplicable > 0)) ? (
                <button
                  id={`btn-apply-all-${selectedCategory}`}
                  onClick={() => onApplyCategory(selectedCategory)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                  <span>
                    Apply all in {selectedCategory === 'data-continuity' ? 'Data Continuity' :
                                  selectedCategory === 'grammar' ? 'Grammar' :
                                  selectedCategory === 'uniformity' ? 'Uniformity' : 'Placeholders'} ({
                      selectedCategory === 'data-continuity' ? dataContinuityApplicable :
                      selectedCategory === 'grammar' ? grammarApplicable :
                      selectedCategory === 'uniformity' ? uniformityApplicable : placeholderApplicable
                    })
                  </span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded-md">
                  No batch fixes available
                </span>
              )}
            </div>

            {displayedIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                isSelected={issue.id === selectedIssueId}
                onSelect={() => onSelectIssue(issue.id)}
                onApply={() => onApplyIssue(issue)}
                onIgnore={() => onIgnoreIssue(issue.id)}
              />
            ))}
          </div>
        ) : (
          /* Grouped by Category Sections with Individual "Apply all in category" buttons */
          <div className="space-y-4">
            {/* 1. Data Continuity Section */}
            {displayedDataContinuity.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/70 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="font-bold text-xs text-blue-950">Data Continuity & Math</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-200/80 text-blue-900">
                      {displayedDataContinuity.length}
                    </span>
                  </div>
                  {dataContinuityApplicable > 0 ? (
                    <button
                      id="btn-apply-all-data-continuity"
                      onClick={() => onApplyCategory('data-continuity')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-blue-200" />
                      <span>Apply all in Data Continuity ({dataContinuityApplicable})</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Requires manual review</span>
                  )}
                </div>
                <div className="space-y-2">
                  {displayedDataContinuity.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      isSelected={issue.id === selectedIssueId}
                      onSelect={() => onSelectIssue(issue.id)}
                      onApply={() => onApplyIssue(issue)}
                      onIgnore={() => onIgnoreIssue(issue.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. Grammar, Spelling & Syntax Section */}
            {displayedGrammar.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/70 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="font-bold text-xs text-emerald-950">Grammar, Spelling & Syntax</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-200/80 text-emerald-900">
                      {displayedGrammar.length}
                    </span>
                  </div>
                  {grammarApplicable > 0 ? (
                    <button
                      id="btn-apply-all-grammar"
                      onClick={() => onApplyCategory('grammar')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-200" />
                      <span>Apply all in Grammar ({grammarApplicable})</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">All verified fixes applied</span>
                  )}
                </div>
                <div className="space-y-2">
                  {displayedGrammar.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      isSelected={issue.id === selectedIssueId}
                      onSelect={() => onSelectIssue(issue.id)}
                      onApply={() => onApplyIssue(issue)}
                      onIgnore={() => onIgnoreIssue(issue.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3. Uniformity & Formatting Section */}
            {displayedUniformity.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-50/80 border border-purple-200/70 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-600" />
                    <span className="font-bold text-xs text-purple-950">Uniformity & Notation</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-200/80 text-purple-900">
                      {displayedUniformity.length}
                    </span>
                  </div>
                  {uniformityApplicable > 0 ? (
                    <button
                      id="btn-apply-all-uniformity"
                      onClick={() => onApplyCategory('uniformity')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-purple-200" />
                      <span>Apply all in Uniformity ({uniformityApplicable})</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">All verified fixes applied</span>
                  )}
                </div>
                <div className="space-y-2">
                  {displayedUniformity.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      isSelected={issue.id === selectedIssueId}
                      onSelect={() => onSelectIssue(issue.id)}
                      onApply={() => onApplyIssue(issue)}
                      onIgnore={() => onIgnoreIssue(issue.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 4. Placeholders Section */}
            {displayedPlaceholder.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/80 border border-rose-200/70 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-600" />
                    <span className="font-bold text-xs text-rose-950">Draft Placeholders & Leaks</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-200/80 text-rose-900">
                      {displayedPlaceholder.length}
                    </span>
                  </div>
                  {placeholderApplicable > 0 ? (
                    <button
                      id="btn-apply-all-placeholder"
                      onClick={() => onApplyCategory('placeholder')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-rose-200" />
                      <span>Apply all in Placeholders ({placeholderApplicable})</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Manual content entry required</span>
                  )}
                </div>
                <div className="space-y-2">
                  {displayedPlaceholder.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      isSelected={issue.id === selectedIssueId}
                      onSelect={() => onSelectIssue(issue.id)}
                      onApply={() => onApplyIssue(issue)}
                      onIgnore={() => onIgnoreIssue(issue.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface IssueCardProps {
  key?: React.Key;
  issue: QAIssue;
  isSelected: boolean;
  onSelect: () => void;
  onApply: () => void;
  onIgnore: () => void;
}

function IssueCard({
  issue,
  isSelected,
  onSelect,
  onApply,
  onIgnore,
}: IssueCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  // Severity styling
  const severityBadge = () => {
    switch (issue.severity) {
      case 'critical':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
            <AlertCircle className="w-3 h-3" />
            <span>Critical</span>
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" />
            <span>Warning</span>
          </span>
        );
      case 'suggestion':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
            <Info className="w-3 h-3" />
            <span>Suggestion</span>
          </span>
        );
    }
  };

  const categoryLabel = () => {
    if (issue.ruleId === 'unlinked-insured-entity') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
          Unlinked Entity
        </span>
      );
    }
    if (issue.ruleId === 'unlinked-location-variance') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
          Location Variance
        </span>
      );
    }
    if (issue.ruleId === 'unlinked-annexure-reference') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
          Missing Annexure
        </span>
      );
    }
    if (issue.ruleId === 'photo-reg-no-mismatch') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
          Photo Plate Mismatch
        </span>
      );
    }
    if (issue.ruleId === 'photo-predates-loss-date') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
          Photo Pre-dates Loss
        </span>
      );
    }
    if (issue.ruleId === 'photo-plate-sequence-gap') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
          Missing Photo No
        </span>
      );
    }
    if (issue.ruleId === 'hardcoded-pagination-desync') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
          Pagination Desync
        </span>
      );
    }
    if (issue.ruleId === 'heading-hierarchy-skip') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
          Heading Hierarchy
        </span>
      );
    }
    if (issue.ruleId === 'surveying-date-sequence-inversion') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
          Date Sequence Error
        </span>
      );
    }
    if (issue.ruleId === 'conflicting-identifier-variant') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
          Policy / Ref Mismatch
        </span>
      );
    }
    if (issue.ruleId === 'assessment-table-notes-discrepancy') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
          Table vs Notes Mismatch
        </span>
      );
    }
    if (issue.ruleId === 'conflicting-repeated-metric') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
          Conflicting Metric
        </span>
      );
    }
    if (issue.ruleId === 'stale-copy-paste-data') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
          Stale Copy-Paste
        </span>
      );
    }
    if (issue.ruleId === 'unchanged-template-default') {
      return (
        <span className="text-[10px] uppercase tracking-wider font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
          Template Default
        </span>
      );
    }

    switch (issue.category) {
      case 'data-continuity':
        return <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600">Data Continuity</span>;
      case 'grammar':
        return <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">Grammar & Spelling</span>;
      case 'uniformity':
        return <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-600">Uniformity</span>;
      case 'placeholder':
        return <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-600">Draft Tag</span>;
      default:
        return <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Typography</span>;
    }
  };

  return (
    <div
      id={`issue-card-${issue.id}`}
      onClick={onSelect}
      className={`bg-white rounded-lg border p-3.5 transition shadow-2xs hover:shadow-xs cursor-pointer ${
        isSelected 
          ? 'border-blue-500 ring-2 ring-blue-100' 
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Header: Category, Severity, Line Number */}
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {categoryLabel()}
          {issue.isAiGenerated && (
            <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
              <span>Gemini AI</span>
            </span>
          )}
          <span className="text-slate-300">•</span>
          <span className="text-[11px] font-mono text-slate-400">Line {issue.lineNumber}</span>
        </div>
        {severityBadge()}
      </div>

      {/* Rule Title & Description */}
      <h4 className="text-xs font-bold text-slate-900 tracking-tight">{issue.title}</h4>
      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{issue.description}</p>

      {/* Diff View (Original vs Suggested) */}
      {issue.originalText && issue.suggestedText !== undefined && (
        <div className="my-2.5 p-2 bg-slate-50 rounded-md border border-slate-100 text-xs font-mono space-y-1">
          {/* Struck-through original */}
          <div className="flex items-start gap-1.5 text-rose-700 bg-rose-50/60 px-1.5 py-0.5 rounded">
            <span className="font-bold select-none text-rose-500">-</span>
            <span className="line-through break-all">{issue.originalText}</span>
          </div>

          {/* Replacement */}
          {issue.suggestedText ? (
            <div className="flex items-start gap-1.5 text-emerald-700 bg-emerald-50/60 px-1.5 py-0.5 rounded">
              <span className="font-bold select-none text-emerald-600">+</span>
              <span className="font-semibold break-all">{issue.suggestedText}</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic px-1.5">
              [Remove from document]
            </div>
          )}
        </div>
      )}

      {/* Rule explanation toggle */}
      {issue.explanation && (
        <div className="mb-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowExplanation(!showExplanation);
            }}
            className="text-[11px] text-blue-600 hover:underline font-medium"
          >
            {showExplanation ? 'Hide verification rationale' : 'Why is this flagged?'}
          </button>
          {showExplanation && (
            <p className="text-[11px] text-slate-500 bg-blue-50/50 p-2 rounded mt-1 border border-blue-100 leading-relaxed">
              {issue.explanation}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onIgnore}
          className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition font-medium flex items-center gap-1"
          title="Dismiss this alert without changing text"
        >
          <X className="w-3 h-3" />
          <span>Ignore</span>
        </button>

        {issue.autoApplicable ? (
          <button
            id={`btn-apply-fix-${issue.id}`}
            onClick={onApply}
            className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition flex items-center gap-1 shadow-2xs"
            title="Auto-apply correction (User Pass)"
          >
            <Check className="w-3 h-3" />
            <span>Apply Fix</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 italic">
            Manual edit recommended
          </span>
        )}
      </div>
    </div>
  );
}
