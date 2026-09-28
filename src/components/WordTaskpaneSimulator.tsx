import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  Wand2, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Printer, 
  Save, 
  ChevronRight, 
  ShieldCheck, 
  Sliders, 
  Layers, 
  Download,
  Info,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  Zap
} from 'lucide-react';
import { QAIssue, ReportStats } from '../types';

interface WordTaskpaneSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  filename: string;
  issues: QAIssue[];
  stats: ReportStats;
  onApplyFix: (issueId: string) => void;
  onApplyAllFixes: () => void;
  onOpenAddinModal: () => void;
}

export const WordTaskpaneSimulator: React.FC<WordTaskpaneSimulatorProps> = ({
  isOpen,
  onClose,
  documentContent,
  filename,
  issues,
  stats,
  onApplyFix,
  onApplyAllFixes,
  onOpenAddinModal,
}) => {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(issues[0]?.id || null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeRibbonTab, setActiveRibbonTab] = useState<'home' | 'docuverify' | 'insert' | 'layout'>('docuverify');
  const [toast, setToast] = useState<string | null>(null);
  const docViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (issues.length > 0 && (!selectedIssueId || !issues.some(i => i.id === selectedIssueId))) {
      setSelectedIssueId(issues[0].id);
    }
  }, [issues, selectedIssueId]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const filteredIssues = activeCategory === 'all' 
    ? issues 
    : issues.filter(i => i.category === activeCategory);

  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  const handleFixAndNotify = (issueId: string) => {
    onApplyFix(issueId);
    showNotification('Replaced text in Word document via Word.run()');
  };

  const handleFixAllAndNotify = () => {
    onApplyAllFixes();
    showNotification('All safe issues auto-corrected in Word document!');
  };

  const handleSimulateNativePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div 
        className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top OS Window Bar (Microsoft Word Native Title Bar) */}
        <div className="bg-[#2B579A] text-white px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-white text-[#2B579A] font-bold text-xs flex items-center justify-center shadow-xs">
              W
            </div>
            <span className="text-xs font-semibold tracking-wide">
              {filename} - Microsoft Word (Native Taskpane Mode)
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-100 text-[10px] font-mono border border-blue-400/30">
              Office.js v1.1 Live Bridge
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddinModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium transition cursor-pointer"
              title="Download manifest to install in your real Word"
            >
              <Download className="w-3 h-3" />
              <span>Get Word manifest.xml</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-rose-600 text-white/80 hover:text-white transition cursor-pointer"
              title="Exit simulator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Word Ribbon */}
        <div className="bg-white border-b border-slate-200 select-none">
          {/* Ribbon Tabs */}
          <div className="flex items-center px-4 pt-1 gap-1 text-xs border-b border-slate-200">
            <button
              onClick={() => setActiveRibbonTab('home')}
              className={`px-3 py-1 font-medium transition rounded-t ${
                activeRibbonTab === 'home' ? 'bg-slate-100 text-[#2B579A] font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveRibbonTab('insert')}
              className={`px-3 py-1 font-medium transition rounded-t ${
                activeRibbonTab === 'insert' ? 'bg-slate-100 text-[#2B579A] font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Insert
            </button>
            <button
              onClick={() => setActiveRibbonTab('layout')}
              className={`px-3 py-1 font-medium transition rounded-t ${
                activeRibbonTab === 'layout' ? 'bg-slate-100 text-[#2B579A] font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Layout
            </button>
            {/* Custom DocuVerify QA Ribbon Tab */}
            <button
              onClick={() => setActiveRibbonTab('docuverify')}
              className={`px-3 py-1.5 font-bold transition rounded-t flex items-center gap-1.5 ${
                activeRibbonTab === 'docuverify' 
                  ? 'bg-blue-50 text-[#2B579A] border-t-2 border-t-[#2B579A] border-x border-slate-200' 
                  : 'text-blue-700 hover:bg-blue-50/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>DocuVerify QA</span>
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                {issues.length}
              </span>
            </button>
          </div>

          {/* Ribbon Toolbar Content */}
          <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-xs min-h-[52px]">
            {activeRibbonTab === 'docuverify' ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                  <button
                    onClick={handleFixAllAndNotify}
                    disabled={issues.length === 0}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded text-slate-700 hover:text-emerald-700 transition disabled:opacity-50"
                  >
                    <Wand2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-bold">Auto-Fix All ({issues.filter(i => i.autoApplicable).length})</span>
                  </button>
                  <button
                    onClick={() => {
                      if (selectedIssue) handleFixAndNotify(selectedIssue.id);
                    }}
                    disabled={!selectedIssue}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded text-slate-700 hover:text-blue-700 transition disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-bold">Fix Selected</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Office.js Connected
                    </span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Score:</span>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {stats.qualityScore}/100
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs text-slate-500 italic">
                Standard Microsoft Word ribbon commands active. Click the "DocuVerify QA" tab to access verification tools.
              </div>
            )}

            {/* Word Save / PDF Print */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulateNativePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                title="Print or Save as PDF using Word's genuine native print engine"
              >
                <Printer className="w-3.5 h-3.5 text-rose-600" />
                <span>Word Export PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in duration-150">
            <Check className="w-4 h-4" />
            <span>{toast}</span>
          </div>
        )}

        {/* Main Body: Word Canvas (Left) + Word Taskpane (Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Authentic Word Page Canvas */}
          <div 
            ref={docViewRef}
            className="flex-1 bg-slate-200/80 p-4 sm:p-8 overflow-y-auto flex flex-col items-center"
          >
            {/* Word A4 Document Page */}
            <div className="w-full max-w-[800px] min-h-[1050px] bg-white shadow-xl border border-slate-300 rounded-sm p-10 sm:p-14 text-slate-800 text-sm leading-relaxed font-serif relative">
              {/* Word Header */}
              <div className="border-b border-slate-200 pb-3 mb-6 flex items-center justify-between text-xs text-slate-400 font-sans">
                <span className="font-semibold text-slate-600">CONFIDENTIAL SURVEY &amp; AUDIT REPORT</span>
                <span>DOC ID: REF-{Math.abs(filename.length * 379)}</span>
              </div>

              {/* Document Text Rendering with Dynamic Yellow Word Highlight */}
              <div className="space-y-4 whitespace-pre-wrap font-sans text-sm text-slate-800">
                {documentContent.split('\n\n').map((paragraph, pIdx) => {
                  // Check if this paragraph contains the selected issue's text
                  const hasSelectedIssue = selectedIssue && paragraph.includes(selectedIssue.originalText);

                  if (hasSelectedIssue && selectedIssue) {
                    const parts = paragraph.split(selectedIssue.originalText);
                    return (
                      <p key={pIdx} className="relative group bg-yellow-50/50 p-1.5 -mx-1.5 rounded transition">
                        <span>{parts[0]}</span>
                        {/* Word Highlight Mark */}
                        <mark 
                          className="bg-yellow-300 text-slate-950 font-medium px-1 py-0.5 rounded-xs ring-2 ring-blue-500 shadow-xs cursor-pointer inline-block"
                          title={`[Flagged Issue] ${selectedIssue.title}: ${selectedIssue.description}`}
                        >
                          {selectedIssue.originalText}
                        </mark>
                        <span>{parts.slice(1).join(selectedIssue.originalText)}</span>

                        {/* Native Word Comment Bubble Simulator on Right Margin */}
                        <span className="hidden xl:flex absolute -right-28 top-0 w-24 p-1.5 bg-yellow-100 border border-yellow-300 text-[10px] rounded shadow-xs text-yellow-900 flex-col gap-0.5">
                          <strong className="font-bold flex items-center gap-1">
                            <Info className="w-2.5 h-2.5" />
                            DocuVerify
                          </strong>
                          <span className="line-clamp-2">{selectedIssue.title}</span>
                        </span>
                      </p>
                    );
                  }

                  // Standard paragraph rendering
                  if (paragraph.startsWith('# ')) {
                    return <h1 key={pIdx} className="text-xl font-bold text-slate-900 border-b pb-2 pt-2">{paragraph.replace(/^# /, '')}</h1>;
                  }
                  if (paragraph.startsWith('## ')) {
                    return <h2 key={pIdx} className="text-base font-bold text-slate-800 pt-2">{paragraph.replace(/^## /, '')}</h2>;
                  }
                  if (paragraph.startsWith('### ')) {
                    return <h3 key={pIdx} className="text-sm font-bold text-slate-700">{paragraph.replace(/^### /, '')}</h3>;
                  }

                  return <p key={pIdx}>{paragraph}</p>;
                })}
              </div>

              {/* Word Footer */}
              <div className="border-t border-slate-200 pt-3 mt-12 flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Verified by DocuVerify QA Engine</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Docked Microsoft Word Taskpane (Office.js) */}
          <div className="w-[360px] sm:w-[400px] bg-white border-l border-slate-300 flex flex-col shadow-lg z-10 shrink-0">
            {/* Taskpane Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">DocuVerify QA Assistant</h3>
                  <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Docked in Word Taskpane
                  </p>
                </div>
              </div>

              <button
                onClick={onOpenAddinModal}
                className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                title="Install in your actual Microsoft Word"
              >
                <span>Install</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Quality Summary & Filter Chips */}
            <div className="p-3 border-b border-slate-100 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Document Health</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  {stats.qualityScore}/100 Score
                </span>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                    activeCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({issues.length})
                </button>
                <button
                  onClick={() => setActiveCategory('data-continuity')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                    activeCategory === 'data-continuity'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Continuity
                </button>
                <button
                  onClick={() => setActiveCategory('placeholder')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                    activeCategory === 'placeholder'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Draft / TBD
                </button>
                <button
                  onClick={() => setActiveCategory('grammar')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                    activeCategory === 'grammar'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Grammar
                </button>
              </div>
            </div>

            {/* Issue Cards List */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50/50">
              {filteredIssues.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">All Issues Resolved!</p>
                  <p className="text-[11px]">The document in Microsoft Word meets all QA and continuity criteria.</p>
                </div>
              ) : (
                filteredIssues.map((issue) => {
                  const isSelected = issue.id === selectedIssueId;
                  return (
                    <div
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer text-xs space-y-2 ${
                        isSelected
                          ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="font-bold text-slate-900 leading-snug">
                          {issue.title}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize shrink-0 ${
                          issue.severity === 'critical' ? 'bg-rose-100 text-rose-800' :
                          issue.severity === 'warning' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {issue.description}
                      </p>

                      {/* Original vs Suggested Text */}
                      <div className="space-y-1 pt-1 text-[11px] font-mono">
                        <div className="bg-rose-50 text-rose-800 p-1.5 rounded border border-rose-100 line-through">
                          {issue.originalText}
                        </div>
                        {issue.suggestedText && (
                          <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded border border-emerald-100 font-semibold flex items-center justify-between">
                            <span>{issue.suggestedText}</span>
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          </div>
                        )}
                      </div>

                      {/* 1-Click Fix Button */}
                      {issue.suggestedText && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFixAndNotify(issue.id);
                            }}
                            className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Zap className="w-3 h-3" />
                            <span>Fix in Word</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Taskpane Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2">
              <button
                onClick={handleFixAllAndNotify}
                disabled={issues.filter(i => i.autoApplicable).length === 0}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Auto-Fix All Verified ({issues.filter(i => i.autoApplicable).length})</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Runs natively inside Word via Office.js</span>
                <button
                  onClick={onOpenAddinModal}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Install Add-in
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
