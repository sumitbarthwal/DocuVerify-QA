import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, 
  Upload, 
  Download, 
  FileText, 
  RotateCcw, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  Printer,
  ChevronDown,
  Layers,
  History,
  CloudCheck,
  Check,
  Eye,
  Play,
  FileCode,
  Table,
  FileSpreadsheet,
  FileJson,
  Sparkles,
  Loader2
} from 'lucide-react';
import { ReportStats, SampleReport, RecentFileRecord } from '../types';
import { SAMPLE_REPORTS } from '../services/sampleReports';
import { formatRelativeTime } from '../services/autoSaveService';

interface NavbarProps {
  filename: string;
  stats: ReportStats;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSelectSample: (sample: SampleReport) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportWord: () => void;
  onExportMarkdown: () => void;
  onExportText: () => void;
  onExportPDF: () => void;
  onExportRTF: () => void;
  onExportHTML: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onPrintCertificate: () => void;
  onOpenPrivacyModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenSummaryModal: () => void;
  onOpenMetricCrossCheckerModal?: () => void;
  activeMobileTab: 'editor' | 'qa';
  onToggleMobileTab: (tab: 'editor' | 'qa') => void;
  totalIssuesCount: number;
  // Recent Files (Last 3)
  recentFiles: RecentFileRecord[];
  onQuickLoadRecent: (file: RecentFileRecord) => void;
  onReworkRecent: (file: RecentFileRecord) => void;
  onViewRecent: (file: RecentFileRecord) => void;
  onDownloadRecent: (file: RecentFileRecord) => void;
  onOpenRecentModal: () => void;
  // Auto-Save Status
  autoSaveTimestamp: number | null;
  // AI Extended Support
  onTriggerAiScan?: () => void;
  isAiScanning?: boolean;
  aiAvailable?: boolean;
  onOpenExportPreview?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  filename,
  stats,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSelectSample,
  onFileUpload,
  onExportWord,
  onExportMarkdown,
  onExportText,
  onExportPDF,
  onExportRTF,
  onExportHTML,
  onExportCSV,
  onExportJSON,
  onPrintCertificate,
  onOpenPrivacyModal,
  onOpenSettingsModal,
  onOpenSummaryModal,
  onOpenMetricCrossCheckerModal,
  activeMobileTab,
  onToggleMobileTab,
  totalIssuesCount,
  recentFiles,
  onQuickLoadRecent,
  onReworkRecent,
  onViewRecent,
  onDownloadRecent,
  onOpenRecentModal,
  autoSaveTimestamp,
  onTriggerAiScan,
  isAiScanning = false,
  aiAvailable = true,
  onOpenExportPreview,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const top3WorkedFiles = recentFiles.slice(0, 3);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Left: Branding & Auto-Save status & Privacy Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-base leading-none">Chingham's DocuVerify</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">QA Engine</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500 truncate max-w-[170px]" title={filename}>
                  {filename}
                </p>
                {/* Auto-Save Indicator */}
                {autoSaveTimestamp && (
                  <span 
                    className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-medium"
                    title={`Auto-saved to local storage at ${new Date(autoSaveTimestamp).toLocaleTimeString()}`}
                  >
                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Auto-saved</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Guarantee Badge */}
          <button
            id="privacy-guarantee-badge"
            onClick={onOpenPrivacyModal}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 transition cursor-pointer"
            title="Click to view client-side zero-cloud privacy architecture"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>100% Offline Engine</span>
          </button>

          {/* Optional AI Extended Deep Scan (Gemini Flash) */}
          {onTriggerAiScan && (
            <button
              id="btn-ai-extended-scan"
              onClick={onTriggerAiScan}
              disabled={isAiScanning}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border shadow-2xs cursor-pointer ${
                isAiScanning
                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300 animate-pulse'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 hover:text-indigo-900'
              }`}
              title={aiAvailable ? "Run online extended AI deep scan using Gemini 3.8 Flash" : "AI support is optional (GEMINI_API_KEY)"}
            >
              {isAiScanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>{isAiScanning ? 'AI Deep Auditing...' : 'AI Extended Scan'}</span>
            </button>
          )}
        </div>

        {/* Center: Mobile Switcher (visible on mobile only) */}
        <div className="flex md:hidden bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => onToggleMobileTab('editor')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              activeMobileTab === 'editor' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => onToggleMobileTab('qa')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMobileTab === 'qa' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>QA Audit</span>
            {totalIssuesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {totalIssuesCount}
              </span>
            )}
          </button>
        </div>

        {/* Right Controls: Undo/Redo, Score, Recent (Last 3), Samples, Upload, Export */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Undo / Redo */}
          <div className="hidden lg:flex items-center border-r border-slate-200 pr-2 mr-1 gap-1">
            <button
              id="btn-undo"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded hover:bg-slate-100 transition ${canUndo ? 'text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
              title="Undo change (Ctrl+Z)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              id="btn-redo"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded hover:bg-slate-100 transition ${canRedo ? 'text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
              title="Redo change (Ctrl+Y)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Quality Score Indicator */}
          <button
            id="btn-quality-score"
            onClick={onOpenSummaryModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition hover:opacity-90 ${getScoreColor(stats.qualityScore)}`}
            title="Click to view QA Verification Scorecard & Certificate"
          >
            {stats.qualityScore >= 85 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>Score {stats.qualityScore}/100</span>
          </button>

          {/* Repetitive Data & Cross-Check Inspector Button */}
          {onOpenMetricCrossCheckerModal && (
            <button
              id="btn-metric-cross-checker"
              onClick={onOpenMetricCrossCheckerModal}
              className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                (stats.continuity?.conflictingMetricsFound ?? 0) > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  : (stats.continuity?.staleCopiedDataFound ?? 0) > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Inspect repetitive data sets, conflicting inputs across sections, and unchanged copied figures"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Data Cross-Check</span>
              {(stats.continuity?.conflictingMetricsFound ?? 0) > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {stats.continuity.conflictingMetricsFound}
                </span>
              )}
            </button>
          )}

          {/* Recent Files Dropdown (Quick Load, Download, View, Rework Last 3 Worked Files) */}
          <div className="relative">
            <button
              id="btn-recent-files"
              onClick={() => { 
                setRecentOpen(!recentOpen); 
                setSamplesOpen(false); 
                setExportOpen(false); 
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              title="Quick load, download, view, or rework last 3 worked documents"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Last 3 Files</span>
              {top3WorkedFiles.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] flex items-center justify-center font-bold">
                  {top3WorkedFiles.length}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {recentOpen && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-40 animate-in fade-in duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Last 3 Worked Files</span>
                  <button
                    onClick={() => {
                      setRecentOpen(false);
                      onOpenRecentModal();
                    }}
                    className="text-blue-600 hover:underline capitalize text-xs font-semibold"
                  >
                    View All
                  </button>
                </div>

                {top3WorkedFiles.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-xs">
                    No worked documents saved yet. Files you inspect or edit will be tracked here.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {top3WorkedFiles.map((file, idx) => (
                      <div key={file.id} className="p-3 hover:bg-slate-50 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                              <span className="text-xs font-bold text-slate-800 truncate block max-w-[190px]" title={file.filename}>
                                {file.filename}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>{formatRelativeTime(file.lastWorkedAt)}</span>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">{file.qualityScore}/100</span>
                              <span>•</span>
                              <span>{file.wordCount} words</span>
                            </div>
                          </div>
                        </div>

                        {/* 4 Dedicated Actions: Load, Rework, View, Download */}
                        <div className="grid grid-cols-4 gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                          {/* 1. Quick Load */}
                          <button
                            onClick={() => {
                              onQuickLoadRecent(file);
                              setRecentOpen(false);
                            }}
                            className="px-1.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition"
                            title="Quick load this document into active session"
                          >
                            <Play className="w-3 h-3" />
                            <span>Load</span>
                          </button>

                          {/* 2. Rework */}
                          <button
                            onClick={() => {
                              onReworkRecent(file);
                              setRecentOpen(false);
                            }}
                            className="px-1.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition"
                            title="Rework document with fresh audit pass"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rework</span>
                          </button>

                          {/* 3. View */}
                          <button
                            onClick={() => {
                              onViewRecent(file);
                              setRecentOpen(false);
                            }}
                            className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition"
                            title="View document in full standard view without overwriting current edits"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {/* 4. Download */}
                          <button
                            onClick={() => {
                              onDownloadRecent(file);
                              setRecentOpen(false);
                            }}
                            className="px-1.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition"
                            title="Download document as Word (.doc)"
                          >
                            <Download className="w-3 h-3" />
                            <span>Doc</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setRecentOpen(false);
                      onOpenRecentModal();
                    }}
                    className="w-full py-1 text-xs font-semibold text-slate-700 hover:text-blue-700 transition"
                  >
                    Open Full Recent Documents Manager &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sample Reports Dropdown */}
          <div className="relative">
            <button
              id="btn-sample-reports"
              onClick={() => { 
                setSamplesOpen(!samplesOpen); 
                setExportOpen(false); 
                setRecentOpen(false); 
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Samples</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {samplesOpen && (
              <div 
                className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40"
                onClick={() => setSamplesOpen(false)}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Test QA Error Verification
                </div>
                {SAMPLE_REPORTS.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => onSelectSample(sample)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition flex flex-col gap-0.5"
                  >
                    <span className="font-semibold text-slate-800">{sample.title}</span>
                    <span className="text-[11px] text-slate-500 line-clamp-1">{sample.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload Button Supporting Multiple Formats */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.pdf,.rtf,.html,.htm,.csv,.tsv,.json,.txt,.md,.markdown,.log"
            onChange={onFileUpload}
            className="hidden"
          />
          <button
            id="btn-upload-document"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Import Word (.docx, .doc), PDF (.pdf), RTF, HTML, CSV, TSV, JSON, Text, or Markdown"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Export / Finalize Dropdown (Multi-Format Support) */}
          <div className="relative">
            <button
              id="btn-export-dropdown"
              onClick={() => { 
                setExportOpen(!exportOpen); 
                setSamplesOpen(false); 
                setRecentOpen(false); 
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-blue-200" />
            </button>

            {exportOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 max-h-[85vh] overflow-y-auto"
                onClick={() => setExportOpen(false)}
              >
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Export Document Formats
                </div>

                {/* Interactive Export & Print Preview */}
                {onOpenExportPreview && (
                  <div className="px-2 py-1 border-b border-slate-100 mb-1">
                    <button
                      id="btn-interactive-export-preview"
                      onClick={() => {
                        setExportOpen(false);
                        onOpenExportPreview();
                      }}
                      className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg flex items-center gap-2 font-semibold transition border border-blue-200"
                    >
                      <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-blue-900 block">Export &amp; Print Preview</span>
                        <span className="text-[10px] text-blue-600 block">Preview Word, PDF, Certificate &amp; Tables</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* 1. Microsoft Word */}
                <button
                  id="export-word-option"
                  onClick={onExportWord}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="font-semibold text-slate-800">Microsoft Word (.doc)</span>
                    <span className="text-[10px] text-slate-400 block">MSO running headers, footers &amp; tables</span>
                  </div>
                </button>

                {/* 2. PDF Document */}
                <button
                  id="export-pdf-option"
                  onClick={onExportPDF}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4 text-rose-600" />
                  <div>
                    <span className="font-semibold text-slate-800">PDF Document (.pdf)</span>
                    <span className="text-[10px] text-slate-400 block">Print-ready standard document view</span>
                  </div>
                </button>

                {/* 3. Rich Text Format */}
                <button
                  id="export-rtf-option"
                  onClick={onExportRTF}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="font-semibold text-slate-800">Rich Text Format (.rtf)</span>
                    <span className="text-[10px] text-slate-400 block">Universal word processing layout</span>
                  </div>
                </button>

                {/* 4. Standalone HTML */}
                <button
                  id="export-html-option"
                  onClick={onExportHTML}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileCode className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="font-semibold text-slate-800">HTML Document (.html)</span>
                    <span className="text-[10px] text-slate-400 block">Self-contained styled document</span>
                  </div>
                </button>

                {/* 5. CSV Tables Extract */}
                <button
                  id="export-csv-option"
                  onClick={onExportCSV}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-semibold text-slate-800">Extract Tables to CSV (.csv)</span>
                    <span className="text-[10px] text-slate-400 block">Structured data tables for Excel</span>
                  </div>
                </button>

                {/* 6. Markdown */}
                <button
                  id="export-markdown-option"
                  onClick={onExportMarkdown}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <div>
                    <span className="font-semibold text-slate-800">Markdown (.md)</span>
                    <span className="text-[10px] text-slate-400 block">Clean structured text with tables</span>
                  </div>
                </button>

                {/* 7. Plain Text */}
                <button
                  id="export-text-option"
                  onClick={onExportText}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="font-semibold text-slate-800">Plain Text (.txt)</span>
                    <span className="text-[10px] text-slate-400 block">Unformatted document text</span>
                  </div>
                </button>

                {/* 8. Full QA Audit Package JSON */}
                <button
                  id="export-json-option"
                  onClick={onExportJSON}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4 text-purple-600" />
                  <div>
                    <span className="font-semibold text-slate-800">QA Audit Package (.json)</span>
                    <span className="text-[10px] text-slate-400 block">Full archive with issues &amp; metrics</span>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                {/* Print QA Certificate & Seal */}
                <button
                  id="export-certificate-option"
                  onClick={onPrintCertificate}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                >
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-semibold text-emerald-700">Print QA Certificate &amp; Seal</span>
                    <span className="text-[10px] text-slate-400 block">Official compliance stamp</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Settings / Rules Filter */}
          <button
            id="btn-rules-settings"
            onClick={onOpenSettingsModal}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Configure QA Rules & Verification Strictness"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
