import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Wand2, 
  Check, 
  Zap, 
  ExternalLink, 
  ArrowLeft,
  Loader2,
  FileText
} from 'lucide-react';
import { QAIssue, ReportStats, RuleConfig } from '../types';
import { runFullDocumentQA, applySingleFix, applyAllVerifiedFixes, DEFAULT_RULE_CONFIG } from '../services/qaEngine';
import { 
  detectOfficeHost, 
  readWordDocument, 
  highlightInNativeWord, 
  fixInNativeWord,
  OfficeHostInfo 
} from '../services/officeAddinService';

interface TaskpaneStandaloneViewProps {
  onExitTaskpaneMode: () => void;
  initialContent?: string;
  initialFilename?: string;
}

export const TaskpaneStandaloneView: React.FC<TaskpaneStandaloneViewProps> = ({
  onExitTaskpaneMode,
  initialContent = '',
  initialFilename = 'Active Document.docx',
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [filename, setFilename] = useState<string>(initialFilename);
  const [hostInfo, setHostInfo] = useState<OfficeHostInfo | null>(null);
  const [isReadingHost, setIsReadingHost] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize and check Office host on mount
  useEffect(() => {
    async function init() {
      const info = await detectOfficeHost();
      setHostInfo(info);

      if (info.isOfficeHost && info.hostType === 'Word') {
        setIsReadingHost(true);
        const doc = await readWordDocument();
        setIsReadingHost(false);
        if (doc && doc.text) {
          setContent(doc.text);
          setFilename(doc.title);
        }
      }
    }
    init();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Run QA Engine on current content
  const { issues, stats } = runFullDocumentQA(content, DEFAULT_RULE_CONFIG);

  useEffect(() => {
    if (issues.length > 0 && (!selectedIssueId || !issues.some(i => i.id === selectedIssueId))) {
      setSelectedIssueId(issues[0].id);
    }
  }, [issues, selectedIssueId]);

  const handleSyncFromWord = async () => {
    setIsReadingHost(true);
    const doc = await readWordDocument();
    setIsReadingHost(false);
    if (doc && doc.text) {
      setContent(doc.text);
      setFilename(doc.title);
      showToast('Synced live text from Microsoft Word!');
    } else {
      showToast('Document re-scanned successfully');
    }
  };

  const handleSelectIssue = async (issue: QAIssue) => {
    setSelectedIssueId(issue.id);
    if (hostInfo?.isOfficeHost && hostInfo.hostType === 'Word') {
      const highlighted = await highlightInNativeWord(issue.originalText);
      if (highlighted) {
        showToast('Highlighted in Microsoft Word');
      }
    }
  };

  const handleFixIssue = async (issue: QAIssue) => {
    if (!issue.suggestedText) return;

    if (hostInfo?.isOfficeHost && hostInfo.hostType === 'Word') {
      const fixed = await fixInNativeWord(issue.originalText, issue.suggestedText);
      if (fixed) {
        // Also update local copy
        const newContent = applySingleFix(content, issue);
        setContent(newContent);
        showToast('Replaced text in Word document!');
        return;
      }
    }

    // Fallback if running outside Word host
    const newContent = applySingleFix(content, issue);
    setContent(newContent);
    showToast('Applied fix to document text');
  };

  const handleAutoFixAll = async () => {
    const autoIssues = issues.filter(i => i.autoApplicable && i.suggestedText);
    if (hostInfo?.isOfficeHost && hostInfo.hostType === 'Word') {
      for (const iss of autoIssues) {
        if (iss.suggestedText) {
          await fixInNativeWord(iss.originalText, iss.suggestedText);
        }
      }
    }
    const newContent = applyAllVerifiedFixes(content, issues);
    setContent(newContent);
    showToast(`Auto-corrected ${autoIssues.length} issues in Word!`);
  };

  const filteredIssues = activeCategory === 'all'
    ? issues
    : issues.filter(i => i.category === activeCategory);

  return (
    <div className="w-full h-screen bg-slate-50 flex flex-col font-sans select-none overflow-hidden">
      {/* Taskpane Top Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h1 className="text-xs font-bold leading-none">DocuVerify QA Taskpane</h1>
            <p className="text-[10px] text-blue-200 mt-0.5 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${hostInfo?.isOfficeHost ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{hostInfo?.isOfficeHost ? `Connected to ${hostInfo.hostType}` : 'Office.js Taskpane Mode'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSyncFromWord}
            disabled={isReadingHost}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
            title="Re-read active document from Word"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReadingHost ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onExitTaskpaneMode}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
            title="Open Full DocuVerify Studio"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-3 py-1.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 animate-in fade-in duration-150 shrink-0">
          <Check className="w-3 h-3" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Document & Health Overview */}
      <div className="bg-white border-b border-slate-200 p-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 truncate max-w-[180px]" title={filename}>
            {filename}
          </span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
            stats.qualityScore >= 85 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            stats.qualityScore >= 70 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            Score {stats.qualityScore}/100
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition whitespace-nowrap ${
              activeCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({issues.length})
          </button>
          <button
            onClick={() => setActiveCategory('data-continuity')}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition whitespace-nowrap ${
              activeCategory === 'data-continuity' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Continuity
          </button>
          <button
            onClick={() => setActiveCategory('placeholder')}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition whitespace-nowrap ${
              activeCategory === 'placeholder' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            TBD / Draft
          </button>
          <button
            onClick={() => setActiveCategory('grammar')}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition whitespace-nowrap ${
              activeCategory === 'grammar' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Grammar
          </button>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-2">
        {filteredIssues.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Document Fully Verified!</p>
            <p className="text-[11px] text-slate-500">Zero critical inconsistencies detected in open document.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isSelected = issue.id === selectedIssueId;
            return (
              <div
                key={issue.id}
                onClick={() => handleSelectIssue(issue)}
                className={`p-2.5 rounded-xl border transition cursor-pointer text-xs space-y-1.5 ${
                  isSelected
                    ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-bold text-slate-900 text-[11px] leading-tight">
                    {issue.title}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded capitalize shrink-0 ${
                    issue.severity === 'critical' ? 'bg-rose-100 text-rose-800' :
                    issue.severity === 'warning' ? 'bg-amber-100 text-amber-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {issue.severity}
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 leading-snug">
                  {issue.description}
                </p>

                <div className="space-y-1 pt-0.5 text-[10px] font-mono">
                  <div className="bg-rose-50 text-rose-800 p-1 rounded border border-rose-100 line-through">
                    {issue.originalText}
                  </div>
                  {issue.suggestedText && (
                    <div className="bg-emerald-50 text-emerald-800 p-1 rounded border border-emerald-100 font-semibold flex items-center justify-between">
                      <span>{issue.suggestedText}</span>
                      <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                    </div>
                  )}
                </div>

                {issue.suggestedText && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFixIssue(issue);
                    }}
                    className="w-full mt-1 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1 shadow-2xs text-[10px]"
                  >
                    <Zap className="w-2.5 h-2.5" />
                    <span>Fix in Document</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Taskpane Sticky Footer Actions */}
      <div className="p-2.5 bg-white border-t border-slate-200 space-y-1.5 shrink-0">
        <button
          onClick={handleAutoFixAll}
          disabled={issues.filter(i => i.autoApplicable).length === 0}
          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Wand2 className="w-3 h-3" />
          <span>Auto-Fix All ({issues.filter(i => i.autoApplicable).length})</span>
        </button>

        <button
          onClick={onExitTaskpaneMode}
          className="w-full py-1 text-center text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          Open Full Studio Window &rarr;
        </button>
      </div>
    </div>
  );
};
