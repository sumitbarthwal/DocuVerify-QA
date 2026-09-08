import React, { useState } from 'react';
import { 
  BarChart3, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  ArrowRight, 
  ExternalLink,
  Layers,
  Sparkles,
  Search
} from 'lucide-react';
import { ExtractedMetric, MetricOccurrence } from '../types';

interface MetricCrossCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: ExtractedMetric[];
  onSelectOffset?: (startOffset: number, endOffset: number) => void;
  onApplySync?: (metric: ExtractedMetric, chosenOcc: MetricOccurrence) => void;
}

export const MetricCrossCheckerModal: React.FC<MetricCrossCheckerModalProps> = ({
  isOpen,
  onClose,
  metrics = [],
  onSelectOffset,
  onApplySync,
}) => {
  const [filter, setFilter] = useState<'all' | 'conflicts' | 'stale' | 'consistent'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const conflictsCount = metrics.filter(m => m.status === 'conflicting').length;
  const consistentCount = metrics.filter(m => m.status === 'consistent').length;

  const filteredMetrics = metrics.filter(m => {
    if (filter === 'conflicts' && m.status !== 'conflicting') return false;
    if (filter === 'consistent' && m.status !== 'consistent') return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = m.displayName.toLowerCase().includes(q);
      const matchVal = m.occurrences.some(o => o.value.toLowerCase().includes(q) || o.rawSnippet.toLowerCase().includes(q));
      return matchName || matchVal;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Repetitive Data & Cross-Metric Audit</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                  {metrics.length} Tracked Data Sets
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Detects conflicting duplicate metrics across sections and suspected stale copy-pasted data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between bg-white">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Metrics ({metrics.length})
            </button>
            <button
              onClick={() => setFilter('conflicts')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                filter === 'conflicts' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Conflicting Inputs ({conflictsCount})</span>
            </button>
            <button
              onClick={() => setFilter('consistent')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                filter === 'consistent' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Consistent ({consistentCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search data metrics or values..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/50">
          {filteredMetrics.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-semibold text-slate-700 text-sm">No matching data metrics found</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery ? 'Try adjusting your search query or filter.' : 'When numbers, percentages, and financial metrics are extracted, they will be indexed here for cross-section consistency.'}
              </p>
            </div>
          ) : (
            filteredMetrics.map((metric) => {
              const isConflict = metric.status === 'conflicting';
              const isConsistent = metric.status === 'consistent';

              return (
                <div
                  key={metric.id}
                  className={`p-4 rounded-xl border bg-white shadow-xs transition ${
                    isConflict 
                      ? 'border-rose-200 ring-1 ring-rose-300' 
                      : isConsistent
                      ? 'border-emerald-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Metric Top Row */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm tracking-tight">
                        {metric.displayName}
                      </span>
                      {isConflict && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          <AlertTriangle className="w-3 h-3" />
                          Conflicting Values
                        </span>
                      )}
                      {isConsistent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Reconciled Across {metric.occurrences.length} Places
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500 font-mono">
                      {metric.occurrences.length} {metric.occurrences.length === 1 ? 'mention' : 'repetitions'}
                    </span>
                  </div>

                  {/* Discrepancy warning banner */}
                  {metric.discrepancySummary && (
                    <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Mismatched Data Stated Across Sections</div>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          {metric.discrepancySummary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Occurrences breakdown */}
                  <div className="space-y-1.5">
                    {metric.occurrences.map((occ, idx) => {
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono shrink-0">
                              Line {occ.lineNumber}
                            </span>
                            <span className="font-bold text-slate-900 shrink-0">
                              {occ.value}
                            </span>
                            <span className="text-slate-500 truncate text-[11px] italic">
                              "{occ.rawSnippet}"
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onSelectOffset && (
                              <button
                                onClick={() => {
                                  onSelectOffset(occ.startOffset, occ.endOffset);
                                  onClose();
                                }}
                                className="px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 rounded transition flex items-center gap-1"
                                title="Jump to this occurrence in editor"
                              >
                                <span>Inspect</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Verifies cross-section consistency, surveying date workflows, policy ID variants, and assessment table vs notes alignment.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
