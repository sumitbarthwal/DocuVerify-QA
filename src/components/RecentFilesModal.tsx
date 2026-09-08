import React, { useState } from 'react';
import { 
  History, 
  X, 
  FileText, 
  Download, 
  RotateCcw, 
  Eye, 
  Play, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  FileCheck2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { RecentFileRecord } from '../types';
import { formatRelativeTime } from '../services/autoSaveService';
import { 
  exportToWordDocument, 
  exportToMarkdownFile, 
  exportToPlainText,
  exportToPDF,
  exportToHTMLDocument
} from '../services/documentFormatsService';

interface RecentFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentFiles: RecentFileRecord[];
  onLoadFile: (file: RecentFileRecord) => void;
  onReworkFile: (file: RecentFileRecord) => void;
  onDeleteFile: (id: string) => void;
  onClearAll: () => void;
}

export const RecentFilesModal: React.FC<RecentFilesModalProps> = ({
  isOpen,
  onClose,
  recentFiles,
  onLoadFile,
  onReworkFile,
  onDeleteFile,
  onClearAll,
}) => {
  const [viewingFile, setViewingFile] = useState<RecentFileRecord | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'word' | 'md' | 'txt' | 'pdf' | 'html'>('word');

  if (!isOpen) return null;

  // We highlight the last 3 worked files
  const top3Files = recentFiles.slice(0, 3);

  const handleDownload = (file: RecentFileRecord, format: 'word' | 'md' | 'txt' | 'pdf' | 'html') => {
    switch (format) {
      case 'word':
        exportToWordDocument(file.content, file.filename);
        break;
      case 'md':
        exportToMarkdownFile(file.content, file.filename);
        break;
      case 'txt':
        exportToPlainText(file.content, file.filename);
        break;
      case 'pdf':
        exportToPDF(file.content, file.filename);
        break;
      case 'html':
        exportToHTMLDocument(file.content, file.filename);
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">Recent Worked Documents</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Last 3 Worked Files
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Quick load, download, view in standard layout, or rework previous document audits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewingFile ? (
            /* Document Full Viewer Drawer */
            <div className="flex flex-col h-full space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingFile(null)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition flex items-center gap-1 shadow-xs"
                  >
                    &larr; Back to List
                  </button>
                  <span className="text-xs font-bold text-slate-800 truncate max-w-sm">
                    {viewingFile.filename}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      onLoadFile(viewingFile);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Quick Load</span>
                  </button>
                  <button
                    onClick={() => {
                      onReworkFile(viewingFile);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rework File</span>
                  </button>
                  <button
                    onClick={() => handleDownload(viewingFile, 'word')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Word</span>
                  </button>
                </div>
              </div>

              {/* Standard Document Sheet View */}
              <div className="bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200 overflow-y-auto max-h-[580px]">
                <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 font-['Calibri',sans-serif] text-slate-800 text-sm">
                  {/* Standard Running Header */}
                  <div className="border-b border-slate-300 pb-2 mb-6 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold text-slate-700">{viewingFile.summaryTitle}</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Standard Document View
                    </span>
                  </div>

                  {/* Document Body */}
                  <div className="whitespace-pre-wrap leading-relaxed space-y-3 font-sans text-xs sm:text-sm">
                    {viewingFile.content}
                  </div>

                  {/* Standard Running Footer */}
                  <div className="border-t border-slate-300 pt-2.5 mt-8 flex items-center justify-between text-xs text-slate-500">
                    <span>Chingham's DocuVerify QA Engine - Verified Record</span>
                    <span>Last Worked: {new Date(viewingFile.lastWorkedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : top3Files.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 mb-1">No Recent Worked Files Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Documents you edit, upload, or verify will automatically appear here so you can quick load, download, view, or rework them.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>Recent Files History (Quick access to your last 3 worked documents)</span>
                {recentFiles.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear History</span>
                  </button>
                )}
              </div>

              <div className="grid gap-3">
                {top3Files.map((file, index) => (
                  <div
                    key={file.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                        #{index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 truncate" title={file.filename}>
                            {file.filename}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                            {file.format || 'DOCX'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Score {file.qualityScore}/100</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {file.summaryTitle}
                        </p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatRelativeTime(file.lastWorkedAt)}</span>
                          </span>
                          <span>•</span>
                          <span>{file.wordCount.toLocaleString()} words</span>
                          <span>•</span>
                          <span>{Math.round(file.sizeBytes / 1024)} KB</span>
                          {file.resolvedCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 font-medium">
                                {file.resolvedCount} QA issues resolved
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Buttons for the Worked File */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {/* 1. Quick Load */}
                      <button
                        onClick={() => {
                          onLoadFile(file);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-blue-200 transition"
                        title="Load this document immediately into your active session"
                      >
                        <Play className="w-3.5 h-3.5 text-blue-600" />
                        <span>Quick Load</span>
                      </button>

                      {/* 2. Rework */}
                      <button
                        onClick={() => {
                          onReworkFile(file);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-indigo-200 transition"
                        title="Load into editor, reset resolution metrics, and focus for a fresh rework audit"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Rework</span>
                      </button>

                      {/* 3. View */}
                      <button
                        onClick={() => setViewingFile(file)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                        title="View document in full standard view without overwriting ongoing edits"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>View</span>
                      </button>

                      {/* 4. Download Dropdown / Button */}
                      <button
                        onClick={() => handleDownload(file, 'word')}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-200 transition"
                        title="Download as Microsoft Word (.doc)"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Download</span>
                      </button>

                      {/* Delete from history */}
                      <button
                        onClick={() => onDeleteFile(file.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Remove from recent files"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Offline local storage persistence enabled</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
