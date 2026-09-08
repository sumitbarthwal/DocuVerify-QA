import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  FileCode, 
  FileSpreadsheet, 
  FileJson, 
  Check, 
  Copy, 
  ShieldCheck, 
  Layers, 
  Eye, 
  Sliders, 
  Maximize2,
  Sparkles,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Info
} from 'lucide-react';
import { ReportStats, QAIssue } from '../types';
import { 
  exportToWordDocument, 
  exportToPDF, 
  exportToRTF, 
  exportToHTMLDocument, 
  exportToCSVExtract, 
  exportToMarkdownFile, 
  exportToPlainText, 
  exportToAuditJSON,
  printAuditCertificate,
  markdownToStyledHtml
} from '../services/documentFormatsService';

export interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  filename: string;
  stats: ReportStats;
  issues: QAIssue[];
  headerText?: string;
  footerText?: string;
  docxBuffer?: ArrayBuffer | null;
  onShowToast: (msg: string) => void;
}

export type ExportFormatTab = 'word' | 'pdf' | 'certificate' | 'markdown' | 'csv' | 'json';

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  isOpen,
  onClose,
  content,
  filename,
  stats,
  issues,
  headerText,
  footerText,
  docxBuffer,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<ExportFormatTab>('word');
  const [paperSize, setPaperSize] = useState<'a4' | 'letter'>('a4');
  const [watermark, setWatermark] = useState<string>('NONE');
  const [includeAppendix, setIncludeAppendix] = useState<boolean>(true);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [customHeader, setCustomHeader] = useState<string>(headerText || '');
  const [customFooter, setCustomFooter] = useState<string>(footerText || '');

  // Keep custom header/footer in sync if props change
  React.useEffect(() => {
    if (headerText) setCustomHeader(headerText);
  }, [headerText]);
  React.useEffect(() => {
    if (footerText) setCustomFooter(footerText);
  }, [footerText]);

  // Document metadata derivation
  const titleMatch = content.match(/^#\s+([^\n\r]+)/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : 'Survey & Assessment Report';

  const refMatch = content.match(/\b(?:survey\s*ref(?:erence)?(?:\s*no\.?|#)?|ref(?:erence)?\s*(?:no\.?|#)?)\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const surveyRef = refMatch ? refMatch[1].trim() : 'SRV-REF-AUTO';

  const policyMatch = content.match(/\b(?:policy\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const policyNo = policyMatch ? policyMatch[1].trim() : 'POL-PENDING';

  const claimMatch = content.match(/\b(?:claim\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const claimNo = claimMatch ? claimMatch[1].trim() : 'CLM-PENDING';

  const effectiveHeader = customHeader.trim() || `${docTitle} | Ref: ${surveyRef}`;
  const effectiveFooter = customFooter.trim() || `Policy: ${policyNo} | Claim: ${claimNo}`;

  // Count tables in content
  const tableCount = useMemo(() => {
    const lines = content.split('\n');
    let count = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].includes('|') && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
        count++;
      }
    }
    return count;
  }, [content]);

  // Extract CSV preview
  const csvPreview = useMemo(() => {
    const lines = content.split('\n');
    const rows: string[] = [];
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
        inTable = true;
        const headerCells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => `"${c.trim()}"`);
        rows.push(headerCells.join(', '));
        i++; // skip separator
        continue;
      }
      if (inTable) {
        if (line.includes('|') && line.length > 0) {
          const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => `"${c.trim()}"`);
          rows.push(cells.join(', '));
        } else {
          inTable = false;
        }
      }
    }
    return rows.length > 0 ? rows.slice(0, 15).join('\n') : 'No tabular data structures detected in document.';
  }, [content]);

  // Estimate pages based on lines
  const estimatedPages = useMemo(() => {
    const lines = content.split('\n').length;
    return Math.max(1, Math.ceil(lines / 45));
  }, [content]);

  // Estimated file sizes
  const estimatedSizes = useMemo(() => {
    const charLen = content.length;
    return {
      docx: `${Math.round((charLen * 1.5 + 18000) / 1024)} KB`,
      pdf: `${Math.round((charLen * 1.8 + 24000) / 1024)} KB`,
      rtf: `${Math.round((charLen * 1.4 + 4000) / 1024)} KB`,
      html: `${Math.round((charLen * 1.3 + 5000) / 1024)} KB`,
      md: `${Math.round(charLen / 1024)} KB`,
      txt: `${Math.round(charLen / 1024)} KB`,
      csv: `${Math.round((charLen * 0.4 + 500) / 1024)} KB`,
      json: `${Math.round((charLen * 2.2 + 8000) / 1024)} KB`,
    };
  }, [content]);

  // Handle clipboard copy
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    onShowToast('Copied preview content to clipboard');
    setTimeout(() => setCopiedText(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Export &amp; Print Preview</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[11px] font-semibold">
                  {filename}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Inspect document layouts, headers, footers, and certification before saving
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar: Tab Selector & Customization */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Format Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('word')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'word'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Word (.docx)</span>
            </button>

            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'pdf'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-rose-600" />
              <span>PDF / Print</span>
            </button>

            <button
              onClick={() => setActiveTab('certificate')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'certificate'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>QA Certificate</span>
            </button>

            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'markdown'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>Markdown / Text</span>
            </button>

            <button
              onClick={() => setActiveTab('csv')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'csv'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              <span>Tables ({tableCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'json'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileJson className="w-3.5 h-3.5 text-purple-600" />
              <span>Audit JSON</span>
            </button>
          </div>

          {/* Context Options (Watermark & Paper Size for Print/Word) */}
          {(activeTab === 'pdf' || activeTab === 'word') && (
            <div className="flex items-center gap-3">
              {/* Watermark Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Watermark:</span>
                <select
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-semibold outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="NONE">None</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="QA VERIFIED">QA VERIFIED</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="OFFICIAL">OFFICIAL</option>
                </select>
              </div>

              {/* Paper Size */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Paper:</span>
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    onClick={() => setPaperSize('a4')}
                    className={`px-2 py-0.5 rounded font-bold transition text-[11px] ${
                      paperSize === 'a4' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    A4
                  </button>
                  <button
                    onClick={() => setPaperSize('letter')}
                    className={`px-2 py-0.5 rounded font-bold transition text-[11px] ${
                      paperSize === 'letter' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    Letter
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body: Active Tab Live Preview Surface */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 flex justify-center">

          {/* TAB 1: WORD (.DOCX) PREVIEW */}
          {activeTab === 'word' && (
            <div className="w-full max-w-3xl flex flex-col gap-4">
              {/* Word Document Page Sheet Preview */}
              <div className="bg-white rounded-xs shadow-xl border border-slate-300 p-8 sm:p-14 font-['Calibri',sans-serif] text-slate-800 relative min-h-[700px]">
                {/* Watermark simulation */}
                {watermark !== 'NONE' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 opacity-10">
                    <span className="text-7xl sm:text-8xl font-black text-slate-900 uppercase -rotate-45 tracking-widest border-8 border-slate-900 p-6 rounded-2xl">
                      {watermark}
                    </span>
                  </div>
                )}

                {/* Running Header */}
                <div className="border-b border-slate-300 pb-2 mb-8 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700 tracking-tight">{effectiveHeader}</span>
                  <span className="font-mono text-slate-400">Microsoft Word OpenXML (.docx)</span>
                </div>

                {/* Rendered Body */}
                <div 
                  className="prose prose-slate max-w-none text-[14px] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: markdownToStyledHtml(content) }}
                />

                {/* Running Footer */}
                <div className="border-t border-slate-300 pt-3 mt-12 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-medium text-slate-600">{effectiveFooter}</span>
                  <span className="font-mono text-slate-600 font-bold">Page 1 of {estimatedPages}</span>
                </div>
              </div>

              {/* Word Metadata Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between shadow-2xs text-xs">
                <div className="flex items-center gap-4 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Estimated Size</span>
                    <span className="font-bold text-slate-800">{estimatedSizes.docx}</span>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Word Pages</span>
                    <span className="font-bold text-slate-800">~{estimatedPages} pages</span>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Headers &amp; Footers</span>
                    <span className="font-bold text-emerald-700">Synchronized &amp; Intact</span>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    await exportToWordDocument(content, filename, effectiveHeader, effectiveFooter, docxBuffer);
                    onShowToast('Downloaded Word document (.docx)');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .docx</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PDF / PRINT PREVIEW */}
          {activeTab === 'pdf' && (
            <div className="w-full max-w-3xl flex flex-col gap-4">
              <div className="bg-white rounded-xs shadow-xl border border-slate-300 p-8 sm:p-14 font-['Times_New_Roman',serif] text-slate-900 relative min-h-[700px]">
                {watermark !== 'NONE' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 opacity-10">
                    <span className="text-7xl sm:text-8xl font-black text-rose-900 uppercase -rotate-45 tracking-widest border-8 border-rose-900 p-6 rounded-2xl">
                      {watermark}
                    </span>
                  </div>
                )}

                {/* Print Header */}
                <div className="border-b-2 border-slate-800 pb-2 mb-8 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold uppercase tracking-wider">{effectiveHeader}</span>
                  <span className="font-serif italic text-slate-500">Standard Document View ({paperSize.toUpperCase()})</span>
                </div>

                {/* Print Body */}
                <div 
                  className="prose max-w-none text-[13px] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: markdownToStyledHtml(content) }}
                />

                {/* Print Footer */}
                <div className="border-t-2 border-slate-800 pt-3 mt-12 flex items-center justify-between text-xs text-slate-600">
                  <span>{effectiveFooter}</span>
                  <span className="font-mono font-bold">Page 1 of {estimatedPages}</span>
                </div>
              </div>

              {/* Print Action Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between shadow-2xs text-xs">
                <div className="flex items-center gap-3 text-slate-600">
                  <Printer className="w-5 h-5 text-rose-600" />
                  <div>
                    <span className="font-bold text-slate-800 block">Browser Print &amp; PDF Engine</span>
                    <span className="text-slate-500 text-[11px]">Includes running headers, footers, and page margins</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      exportToPDF(content, filename, effectiveHeader, effectiveFooter);
                      onShowToast('Opening Print / PDF dialog...');
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QA AUDIT CERTIFICATE PREVIEW */}
          {activeTab === 'certificate' && (
            <div className="w-full max-w-3xl flex flex-col gap-4">
              <div className="bg-white rounded-xl shadow-xl border-2 border-slate-300 p-8 sm:p-12 text-slate-800 relative">
                {/* Certificate Border Accents */}
                <div className="border-2 border-dashed border-slate-200 p-6 sm:p-8 rounded-lg relative">
                  
                  {/* Top Seal & Title */}
                  <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 shadow-2xs">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] uppercase tracking-widest font-black text-slate-400">
                      Official Document Quality Assurance Certificate
                    </span>
                    <h1 className="text-2xl font-black text-slate-900 mt-1">
                      DocuVerify Quality Audit Seal
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      This certificate verifies that {filename} has undergone comprehensive multi-pass deterministic QA inspection.
                    </p>
                  </div>

                  {/* Score & Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Quality Score</span>
                      <span className={`text-2xl font-black ${
                        stats.qualityScore >= 85 ? 'text-emerald-700' : stats.qualityScore >= 70 ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {stats.qualityScore}/100
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Issues</span>
                      <span className="text-2xl font-black text-slate-800">
                        {issues.filter(i => !i.ignored).length}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Word Count</span>
                      <span className="text-2xl font-black text-slate-800">
                        {stats.wordCount}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Data Continuity</span>
                      <span className="text-2xl font-black text-emerald-700">
                        {(stats.continuity?.conflictingMetricsFound ?? 0) === 0 ? 'Verified' : 'Flagged'}
                      </span>
                    </div>
                  </div>

                  {/* Audit Metadata & Sign-off */}
                  <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Verification Date</span>
                      <span className="font-semibold text-slate-800">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Document Reference</span>
                      <span className="font-semibold text-slate-800 font-mono">{surveyRef}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">Verification Authority</span>
                      <span className="font-bold text-slate-800">Chingham's DocuVerify QA Engine</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificate Actions */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between shadow-2xs text-xs">
                <span className="text-slate-600">
                  Ready for client compliance delivery or archival record keeping.
                </span>
                <button
                  onClick={() => printAuditCertificate(stats, issues, filename)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Official Certificate</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: MARKDOWN / PLAIN TEXT PREVIEW */}
          {activeTab === 'markdown' && (
            <div className="w-full max-w-3xl flex flex-col gap-4">
              <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6 text-slate-200 font-mono text-xs overflow-x-auto min-h-[500px] leading-relaxed">
                <pre className="whitespace-pre-wrap">{content}</pre>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between shadow-2xs text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">
                    Characters: <strong>{content.length}</strong> • Lines: <strong>{content.split('\n').length}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyText(content)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 transition"
                  >
                    {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
                  </button>

                  <button
                    onClick={() => {
                      exportToMarkdownFile(content, filename);
                      onShowToast('Downloaded Markdown document (.md)');
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .md</span>
                  </button>

                  <button
                    onClick={() => {
                      exportToPlainText(content, filename);
                      onShowToast('Downloaded Plain Text document (.txt)');
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TABLES EXTRACT (CSV) PREVIEW */}
          {activeTab === 'csv' && (
            <div className="w-full max-w-3xl flex flex-col gap-4">
              <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Extracted Tabular Data Preview</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                    {tableCount} tables identified
                  </span>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 font-mono text-xs text-slate-700 overflow-x-auto whitespace-pre leading-relaxed border border-slate-200 max-h-96">
                  {csvPreview}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between shadow-2xs text-xs">
                <span className="text-slate-500">
                  Easily import all document tables directly into Microsoft Excel or Google Sheets.
                </span>

                <button
                  onClick={() => {
                    exportToCSVExtract(content, filename);
                    onShowToast('Downloaded extracted tables (.csv)');
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .csv Tables</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: FULL QA AUDIT JSON PACKAGE */}
          {activeTab === 'json' && (
            <div className="w-full max-w-3xl flex flex-col gap-4">
              <div className="bg-slate-950 rounded-xl shadow-xl border border-slate-800 p-6 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[550px] leading-relaxed">
                <pre>{JSON.stringify({
                  archiveType: 'Chinghams_DocuVerify_Audit_Package_v2.5',
                  filename,
                  qualityScore: stats.qualityScore,
                  totalActiveIssues: issues.filter(i => !i.ignored).length,
                  stats: {
                    wordCount: stats.wordCount,
                    characterCount: stats.charCount,
                    readability: stats.readability,
                    continuity: stats.continuity,
                  },
                  topIssuesSample: issues.slice(0, 3).map(i => ({
                    id: i.id,
                    title: i.title,
                    category: i.category,
                    severity: i.severity,
                    originalText: i.originalText,
                    suggestedText: i.suggestedText
                  }))
                }, null, 2)}</pre>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between shadow-2xs text-xs">
                <span className="text-slate-500">
                  Full machine-readable QA report archive for API integration and audit compliance.
                </span>

                <button
                  onClick={() => {
                    exportToAuditJSON(content, filename, stats, issues);
                    onShowToast('Downloaded QA Audit JSON package');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Audit JSON</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Info className="w-4 h-4 text-blue-600" />
            <span>All exports preserve verified edits, running headers, footers, and QA standards.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
