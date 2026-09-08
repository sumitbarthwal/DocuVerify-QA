import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  Table as TableIcon, 
  Search, 
  Replace, 
  Eye, 
  Edit3, 
  Clock, 
  FileText, 
  BookOpen, 
  Sparkles,
  Wand2,
  Check,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  X,
  Sliders,
  Maximize2,
  Image as ImageIcon,
  Scissors,
  Columns2,
  SplitSquareHorizontal,
  Plus
} from 'lucide-react';
import { QAIssue, ReportStats } from '../types';
import { autoFormatDocumentText } from '../services/uniformityRules';
import { DocumentPageView } from './DocumentPageView';
import { FloatingFixBox } from './FloatingFixBox';
import { DocumentPhotoViewer } from './DocumentPhotoViewer';

interface DocumentEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  issues: QAIssue[];
  stats: ReportStats;
  selectedIssueId: string | null;
  onSelectIssue: (id: string | null) => void;
  headerText?: string;
  footerText?: string;
  docxBuffer?: ArrayBuffer | null;
  onDocxBufferChange?: (buffer: ArrayBuffer) => void;
  images?: Array<{ name: string; dataUrl: string }>;
  onOpenHeaderFooterModal?: () => void;
  onApplyFix?: (issue: QAIssue) => void;
  onApplyManualFix?: (issue: QAIssue, replacement: string) => void;
  onIgnoreIssue?: (issueId: string) => void;
  onOpenExportPreview?: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  content,
  onChange,
  issues,
  stats,
  selectedIssueId,
  onSelectIssue,
  headerText,
  footerText,
  docxBuffer,
  onDocxBufferChange,
  images,
  onOpenHeaderFooterModal,
  onApplyFix,
  onApplyManualFix,
  onIgnoreIssue,
  onOpenExportPreview,
}) => {
  const [viewMode, setViewMode] = useState<'page' | 'split' | 'edit' | 'preview'>('page');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [formatNotice, setFormatNotice] = useState<string | null>(null);
  const [showHeaderFooterSync, setShowHeaderFooterSync] = useState(true);

  // Floating fix box state in Audit Overlay Mode
  const [overlayActiveIssue, setOverlayActiveIssue] = useState<QAIssue | null>(null);
  const [overlayTargetRect, setOverlayTargetRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);

  // Photo viewer state
  const [activePhoto, setActivePhoto] = useState<{ src: string; alt: string; caption?: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Sync scroll line numbers with textarea
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Extract metadata for persistent header/footer synchronicity
  const titleMatch = content.match(/^#\s+([^\n\r]+)/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : 'Survey & Assessment Report';

  const refMatch = content.match(/\b(?:survey\s*ref(?:erence)?(?:\s*no\.?|#)?|ref(?:erence)?\s*(?:no\.?|#)?)\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const surveyRef = refMatch ? refMatch[1].trim() : 'SRV-REF-AUTO';

  const policyMatch = content.match(/\b(?:policy\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const policyNo = policyMatch ? policyMatch[1].trim() : 'POL-PENDING';

  const claimMatch = content.match(/\b(?:claim\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const claimNo = claimMatch ? claimMatch[1].trim() : 'CLM-PENDING';

  const effectiveHeader = (headerText && headerText.trim()) ? headerText : `${docTitle} | Ref: ${surveyRef}`;
  const effectiveFooter = (footerText && footerText.trim()) ? footerText : `Policy: ${policyNo} | Claim: ${claimNo}`;

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Format actions helper
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);

    const newText = content.slice(0, start) + prefix + (selected || 'Text') + suffix + content.slice(end);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length + (selected ? 0 : 4));
    }, 10);
  };

  const handleInsertTable = () => {
    const tableTemplate = `\nTable 1: Operational Metrics Summary\n| Metric Name | Baseline | Q3 Target | Actual |\n|---|---|---|---|\n| System Uptime | 99.9% | 99.95% | 99.98% |\n| Latency (ms) | 42ms | 35ms | 32ms |\n`;
    insertFormatting(tableTemplate);
  };

  const handleAutoFormat = () => {
    const formatted = autoFormatDocumentText(content);
    onChange(formatted);
    setFormatNotice('Document formatted: tables aligned, spacing normalized, trailing spaces purged');
    setTimeout(() => setFormatNotice(null), 3500);
  };

  const handleInsertPageBreak = () => {
    insertFormatting('\n\n---\n<!-- Page Break -->\n\n');
    setFormatNotice('Manual page break inserted (---)');
    setTimeout(() => setFormatNotice(null), 2500);
  };

  // Find and replace operations
  useEffect(() => {
    if (!findQuery) {
      setMatchCount(0);
      return;
    }
    try {
      const regex = new RegExp(escapeRegExp(findQuery), 'gi');
      const matches = content.match(regex);
      setMatchCount(matches ? matches.length : 0);
    } catch {
      setMatchCount(0);
    }
  }, [findQuery, content]);

  const handleReplaceAll = () => {
    if (!findQuery) return;
    try {
      const regex = new RegExp(escapeRegExp(findQuery), 'gi');
      const updated = content.replace(regex, replaceQuery);
      onChange(updated);
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate lines for gutter and page estimation
  const lineCount = Math.max(1, (content.match(/\n/g) || []).length + 1);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
  const explicitBreaksCount = (content.match(/^\s*(?:---|\*\*\*|___)\s*$/gm) || []).length;
  const estimatedPagesCount = Math.max(1, Math.ceil(lineCount / 48) + explicitBreaksCount);

  // Jump to issue in Textarea editor
  const jumpToIssueInEditor = (issue: QAIssue) => {
    setViewMode('edit');
    setTimeout(() => {
      if (textareaRef.current && issue.startOffset >= 0) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(issue.startOffset, issue.endOffset);
        const textBefore = content.slice(0, issue.startOffset);
        const line = (textBefore.match(/\n/g) || []).length;
        const lineHeight = 24;
        textareaRef.current.scrollTop = Math.max(0, line * lineHeight - 120);
      }
    }, 50);
  };

  // Scroll to selected issue offset if available across all view modes
  useEffect(() => {
    if (!selectedIssueId) {
      setOverlayActiveIssue(null);
      setOverlayTargetRect(null);
      return;
    }

    const issue = issues.find(i => i.id === selectedIssueId);

    if (viewMode === 'preview' && issue) {
      setOverlayActiveIssue(issue);
      const el = document.getElementById(`issue-highlight-${selectedIssueId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-blue-500', 'animate-pulse');
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setOverlayTargetRect({
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          });
          el.classList.remove('ring-4', 'ring-blue-500', 'animate-pulse');
        }, 120);
      } else {
        setOverlayTargetRect(null);
      }
    } else if (viewMode === 'edit' && textareaRef.current && issue) {
      if (issue.startOffset >= 0) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(issue.startOffset, issue.endOffset);
        const textBefore = content.slice(0, issue.startOffset);
        const line = (textBefore.match(/\n/g) || []).length;
        const lineHeight = 24;
        textareaRef.current.scrollTop = Math.max(0, line * lineHeight - 120);
      }
    }
  }, [selectedIssueId, viewMode, issues, content]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden relative select-text">
      {/* Editor Top Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-1">
          {/* Format buttons */}
          <button
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition"
            title="Bold (**text**)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition"
            title="Italic (*text*)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-300 mx-1" />
          <button
            onClick={() => insertFormatting('# ')}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition text-xs font-bold"
            title="Heading 1 (# Title)"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('## ')}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition text-xs font-bold"
            title="Heading 2 (## Subheading)"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('- ')}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition"
            title="Bullet List (- item)"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={handleInsertTable}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition"
            title="Insert Structured Table"
          >
            <TableIcon className="w-4 h-4" />
          </button>
          
          {/* Insert Page Break */}
          <button
            onClick={handleInsertPageBreak}
            className="px-2 py-1 text-slate-700 hover:text-blue-900 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded transition flex items-center gap-1.5 text-xs font-semibold"
            title="Insert a page break marker (---) into the document"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Page Break</span>
          </button>

          <button
            onClick={handleAutoFormat}
            className="px-2 py-1 text-slate-700 hover:text-indigo-900 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded transition flex items-center gap-1.5 text-xs font-semibold"
            title="Auto-format document: align markdown tables, trim trailing whitespace, normalize line spacing"
          >
            <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Format &amp; Align</span>
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1" />
          
          {/* Find & Replace trigger */}
          <button
            onClick={() => setShowFindReplace(!showFindReplace)}
            className={`p-1.5 rounded transition flex items-center gap-1 text-xs font-medium ${
              showFindReplace ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
            title="Find and Replace"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Find</span>
          </button>
        </div>

        {/* Multi-View Switcher: Word Page Layout vs Split View vs Audit Overlay vs Text Editor */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => {
                setViewMode('page');
                setOverlayActiveIssue(null);
              }}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'page'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Word Page Document Layout"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Word View</span>
            </button>

            <button
              onClick={() => {
                setViewMode('split');
                setOverlayActiveIssue(null);
              }}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'split'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Split View: Text editor on left, live updating Word Page View on right"
            >
              <Columns2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Split View</span>
            </button>

            <button
              onClick={() => {
                setViewMode('preview');
                setOverlayActiveIssue(null);
              }}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'preview'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Audit Overlay with interactive error highlights"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Audit Overlay</span>
            </button>

            <button
              onClick={() => {
                setViewMode('edit');
                setOverlayActiveIssue(null);
              }}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'edit'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Full Text and Markdown Editor"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
          </div>

          {/* Export & Print Preview Button */}
          {onOpenExportPreview && (
            <button
              onClick={onOpenExportPreview}
              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition flex items-center gap-1.5 shadow-2xs"
              title="Open interactive multi-format export and print preview"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Export Preview</span>
            </button>
          )}
        </div>
      </div>

      {/* Find & Replace Bar */}
      {showFindReplace && (
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-100/90 flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2 py-1 shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Find text..."
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              className="outline-hidden text-slate-800 w-32 sm:w-44"
              autoFocus
            />
            {findQuery && (
              <span className="text-[10px] text-slate-400 font-mono">
                {matchCount} {matchCount === 1 ? 'match' : 'matches'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2 py-1 shadow-2xs">
            <Replace className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="outline-hidden text-slate-800 w-32 sm:w-44"
            />
          </div>

          <button
            onClick={handleReplaceAll}
            disabled={!findQuery || matchCount === 0}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Replace All
          </button>

          <button
            onClick={() => setShowFindReplace(false)}
            className="p-1 text-slate-400 hover:text-slate-600 ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Auto-Format Notification Toast */}
      {formatNotice && (
        <div className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>{formatNotice}</span>
        </div>
      )}

      {/* Synchronized Running Header & Footer Audit Indicator */}
      {showHeaderFooterSync && (
        <div className="bg-slate-50/95 border-b border-slate-200 px-4 py-1.5 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px] bg-slate-200/80 px-1.5 py-0.5 rounded">
              Original Header
            </span>
            <span className="text-slate-800 font-medium truncate max-w-xs">{effectiveHeader}</span>
            <span className="text-slate-300">|</span>
            {onOpenHeaderFooterModal && (
              <button
                onClick={onOpenHeaderFooterModal}
                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold"
                title="Review original draft header and footer"
              >
                <Sliders className="w-3 h-3 text-blue-600" />
                <span>Configure Header/Footer</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px] bg-slate-200/80 px-1.5 py-0.5 rounded">
              Original Footer
            </span>
            <span className="text-slate-700 font-medium truncate max-w-xs">{effectiveFooter}</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-700 font-semibold font-mono text-[10px]">Page &#123;PAGE&#125; of &#123;NUMPAGES&#125;</span>
            <button 
              onClick={() => setShowHeaderFooterSync(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 ml-1"
              title="Hide Running Header/Footer Bar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main Document Content Canvas */}
      <div className="flex-1 relative flex overflow-hidden">
        {viewMode === 'page' ? (
          <DocumentPageView
            content={content}
            onChange={onChange}
            issues={issues}
            stats={stats}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
            headerText={headerText}
            footerText={footerText}
            docxBuffer={docxBuffer}
            onDocxBufferChange={onDocxBufferChange}
            images={images}
            onOpenHeaderFooterModal={onOpenHeaderFooterModal}
            onApplyFix={onApplyFix}
            onApplyManualFix={onApplyManualFix}
            onIgnoreIssue={onIgnoreIssue}
            onJumpToEditor={jumpToIssueInEditor}
          />
        ) : viewMode === 'split' ? (
          /* Split View: Left side Text Editor, Right side Live Document Page View */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Left Column: Interactive Text Editor */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col bg-white overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Markdown / Raw Source</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Auto-syncs right</span>
              </div>
              <div className="flex-1 relative flex overflow-hidden">
                <div
                  ref={lineNumbersRef}
                  className="w-11 bg-slate-50 border-r border-slate-200/80 py-3 select-none overflow-hidden text-right pr-2 font-mono text-xs text-slate-400"
                >
                  {lineNumbers.slice(0, 300).map((num) => (
                    <div key={num} className="leading-6">
                      {num}
                    </div>
                  ))}
                </div>
                <textarea
                  value={content}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Write or edit document here..."
                  className="w-full h-full p-3 outline-hidden resize-none font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 text-[14px] leading-6 bg-white overflow-y-auto selection:bg-blue-100"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Right Column: Live Word Page View */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col overflow-hidden bg-slate-100">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Live Word Document Preview</span>
                </span>
                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Rendering
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <DocumentPageView
                  content={content}
                  onChange={onChange}
                  issues={issues}
                  stats={stats}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={onSelectIssue}
                  headerText={headerText}
                  footerText={footerText}
                  docxBuffer={docxBuffer}
                  onDocxBufferChange={onDocxBufferChange}
                  images={images}
                  onOpenHeaderFooterModal={onOpenHeaderFooterModal}
                  onApplyFix={onApplyFix}
                  onApplyManualFix={onApplyManualFix}
                  onIgnoreIssue={onIgnoreIssue}
                  onJumpToEditor={jumpToIssueInEditor}
                />
              </div>
            </div>
          </div>
        ) : viewMode === 'edit' ? (
          <>
            {/* Line Numbers Gutter */}
            <div
              ref={lineNumbersRef}
              className="hidden sm:block w-12 bg-slate-50 border-r border-slate-200/80 py-4 select-none overflow-hidden text-right pr-3 font-mono text-xs text-slate-400"
            >
              {lineNumbers.map((num) => (
                <div key={num} className="leading-6">
                  {num}
                </div>
              ))}
            </div>

            {/* Editable Textarea with Page Break Visualiser Helper Bar */}
            <div className="flex-1 relative h-full flex flex-col">
              <div className="px-4 py-1.5 bg-indigo-50/70 border-b border-indigo-100 text-xs text-indigo-900 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    <strong>Page Break Visualiser:</strong> ~{estimatedPagesCount} estimated page{estimatedPagesCount !== 1 ? 's' : ''} ({explicitBreaksCount} manual page break{explicitBreaksCount !== 1 ? 's' : ''})
                  </span>
                </div>
                <button
                  onClick={handleInsertPageBreak}
                  className="px-2 py-0.5 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 font-semibold rounded text-[11px] transition flex items-center gap-1 shadow-2xs"
                  title="Insert a page break marker (---) into document"
                >
                  <Plus className="w-3 h-3" />
                  <span>Insert Page Break</span>
                </button>
              </div>

              <textarea
                ref={textareaRef}
                id="document-editor-textarea"
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                placeholder="Paste, write, or upload your document report here to begin automated QA verification..."
                className="w-full flex-1 p-4 sm:p-6 outline-hidden resize-none font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 text-[15px] leading-6 bg-white overflow-y-auto selection:bg-blue-100"
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          /* Audit Overlay View: Visual highlight of issues in context */
          <div 
            ref={previewContainerRef}
            className="flex-1 p-6 overflow-y-auto bg-white text-slate-800 text-[15px] leading-relaxed relative"
            onClick={() => {
              if (overlayActiveIssue) {
                setOverlayActiveIssue(null);
                setOverlayTargetRect(null);
                onSelectIssue(null);
              }
            }}
          >
            <div className="max-w-3xl mx-auto">
              <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Audit Overlay Mode</span>
                <span>Click any highlighted segment to open the fix box directly above or below it</span>
              </div>
              <RenderHighlightedText 
                text={content} 
                issues={issues} 
                selectedIssueId={selectedIssueId} 
                onSelectIssue={(issue, rect) => {
                  onSelectIssue(issue.id);
                  setOverlayActiveIssue(issue);
                  setOverlayTargetRect(rect);
                }}
                onPhotoClick={(photo) => setActivePhoto(photo)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating Fix Box in Audit Overlay Mode */}
      {viewMode === 'preview' && overlayActiveIssue && (
        <FloatingFixBox
          issue={overlayActiveIssue}
          targetRect={overlayTargetRect}
          onApplyFix={(issue) => {
            if (onApplyFix) {
              onApplyFix(issue);
            } else if (issue.startOffset >= 0 && issue.endOffset <= content.length) {
              const updated = content.slice(0, issue.startOffset) + issue.suggestedText + content.slice(issue.endOffset);
              onChange(updated);
            }
            setOverlayActiveIssue(null);
            setOverlayTargetRect(null);
            onSelectIssue(null);
          }}
          onApplyManualFix={(issue, replacement) => {
            if (onApplyManualFix) {
              onApplyManualFix(issue, replacement);
            } else if (issue.startOffset >= 0 && issue.endOffset <= content.length) {
              const updated = content.slice(0, issue.startOffset) + replacement + content.slice(issue.endOffset);
              onChange(updated);
            }
            setOverlayActiveIssue(null);
            setOverlayTargetRect(null);
            onSelectIssue(null);
          }}
          onIgnoreIssue={(id) => {
            if (onIgnoreIssue) onIgnoreIssue(id);
            setOverlayActiveIssue(null);
            setOverlayTargetRect(null);
            onSelectIssue(null);
          }}
          onClose={() => {
            setOverlayActiveIssue(null);
            setOverlayTargetRect(null);
            onSelectIssue(null);
          }}
          onJumpToEditor={() => jumpToIssueInEditor(overlayActiveIssue)}
        />
      )}

      {/* Document Photo High-Resolution Viewer Modal */}
      {activePhoto && (
        <DocumentPhotoViewer
          isOpen={!!activePhoto}
          src={activePhoto.src}
          alt={activePhoto.alt}
          caption={activePhoto.caption}
          onClose={() => setActivePhoto(null)}
        />
      )}

      {/* Editor Footer / Document Statistics Bar */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title="Total Words">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">{stats.wordCount.toLocaleString()}</span> words
          </div>
          <div className="flex items-center gap-1.5" title="Estimated Reading Time">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{stats.readingTimeMinutes} min read</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5" title="Readability Level">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>{stats.readability.readingEase}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{issues.filter(i => i.severity === 'critical').length} Critical</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{issues.filter(i => i.severity === 'warning').length} Warnings</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{issues.filter(i => i.severity === 'suggestion').length} Suggestions</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component: Render text with clickable colored highlights for issues + support photo plates
function RenderHighlightedText({
  text,
  issues,
  selectedIssueId,
  onSelectIssue,
  onPhotoClick,
}: {
  text: string;
  issues: QAIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (issue: QAIssue, rect: { top: number; bottom: number; left: number; right: number; width: number; height: number }) => void;
  onPhotoClick: (photo: { src: string; alt: string; caption?: string }) => void;
}) {
  // Check if there are markdown images
  const lines = text.split('\n');
  const renderedLines: React.ReactNode[] = [];
  let charOffset = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();
    const lineStart = charOffset;
    const lineEnd = charOffset + rawLine.length;

    // Check for image
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1] || 'Document Photo Evidence';
      const src = imgMatch[2];
      renderedLines.push(
        <div 
          key={`preview-img-${idx}`}
          className="my-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center cursor-pointer hover:border-blue-400 transition"
          onClick={(e) => {
            e.stopPropagation();
            onPhotoClick({ src, alt, caption: 'Extracted Document Photo Plate' });
          }}
        >
          <img 
            src={src} 
            alt={alt} 
            className="max-h-60 max-w-full rounded border border-slate-300 mx-auto shadow-xs" 
            loading="lazy"
          />
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{alt} (Click to inspect)</span>
          </div>
        </div>
      );
      charOffset += rawLine.length + 1;
      continue;
    }

    // Filter issues in this line
    const lineIssues = issues.filter(
      i => i.startOffset < lineEnd && i.endOffset > lineStart && i.startOffset < i.endOffset
    );

    if (lineIssues.length === 0) {
      renderedLines.push(
        <div key={`line-${idx}`} className="min-h-[1.5rem]">
          {rawLine}
        </div>
      );
    } else {
      // Segment line
      const segments: React.ReactNode[] = [];
      let lastRel = 0;
      const sorted = [...lineIssues].sort((a, b) => a.startOffset - b.startOffset);

      for (const issue of sorted) {
        const relStart = Math.max(0, issue.startOffset - lineStart);
        const relEnd = Math.min(rawLine.length, issue.endOffset - lineStart);

        if (relStart < lastRel) continue;

        if (relStart > lastRel) {
          segments.push(
            <span key={`plain-${lastRel}`}>{rawLine.slice(lastRel, relStart)}</span>
          );
        }

        const isSelected = issue.id === selectedIssueId;
        let badgeColor = 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200';
        if (issue.severity === 'warning') {
          badgeColor = 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
        } else if (issue.severity === 'suggestion') {
          badgeColor = 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200';
        }

        segments.push(
          <mark
            key={`issue-${issue.id}`}
            id={`issue-highlight-${issue.id}`}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onSelectIssue(issue, {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
              });
            }}
            className={`px-1 py-0.5 mx-0.5 rounded cursor-pointer border border-dashed transition relative inline-block ${badgeColor} ${
              isSelected ? 'ring-2 ring-blue-500 font-medium scale-105' : ''
            }`}
            title={`${issue.title}: ${issue.description} (Click to open fix box)`}
          >
            {rawLine.slice(relStart, relEnd)}
          </mark>
        );

        lastRel = relEnd;
      }

      if (lastRel < rawLine.length) {
        segments.push(
          <span key={`plain-end`}>{rawLine.slice(lastRel)}</span>
        );
      }

      renderedLines.push(
        <div key={`line-${idx}`} className="min-h-[1.5rem]">
          {segments}
        </div>
      );
    }

    charOffset += rawLine.length + 1;
  }

  return <div className="font-sans space-y-0.5">{renderedLines}</div>;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
