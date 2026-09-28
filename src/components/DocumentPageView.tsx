import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  QAIssue, 
  ReportStats 
} from '../types';
import { 
  FileText, 
  Check, 
  X, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Sparkles, 
  Edit3, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  CheckCircle2,
  Maximize2,
  Image as ImageIcon,
  Sliders,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers,
  Maximize,
  Scissors,
  Columns2,
  Plus,
  SplitSquareHorizontal,
  Search,
  Replace,
  Wand2,
  Printer,
  Download,
  Save,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  Heading1,
  Heading2,
  Type,
  Minus,
  HelpCircle,
  FileCheck2,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';
import { FloatingFixBox } from './FloatingFixBox';
import { DocumentPhotoViewer } from './DocumentPhotoViewer';
import { WordDocumentViewer } from './WordDocumentViewer';
import { createStandardDocxPackage, downloadDocxFile } from '../services/docxEngineService';
import { autoFormatDocumentText } from '../services/uniformityRules';

export type WordViewMode = 'print-layout' | 'read-mode' | 'web-layout' | 'raw-openxml';
export type WordRibbonTab = 'home' | 'insert' | 'layout' | 'review' | 'view';

export interface DocumentPageViewProps {
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
  onJumpToEditor?: (issue: QAIssue) => void;
  filename?: string;
  onApplyAllVerified?: () => void;
  onTriggerAiScan?: () => void;
  isAiScanning?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export interface DocumentPageItem {
  pageNumber: number;
  content: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  title: string;
  breakType?: 'explicit' | 'overflow' | 'heading' | 'end';
  lineCount: number;
  wordCount: number;
  isOverflow: boolean;
}

/**
 * Splits document content into discrete physical-style pages for authentic Microsoft Word Print Layout.
 * Accurately calculates page sheet capacities, respects explicit breaks (---),
 * and prevents breaking tables or code blocks across page boundaries.
 */
function splitContentIntoPages(fullContent: string, linesPerPage: number = 44): DocumentPageItem[] {
  if (!fullContent || fullContent.trim().length === 0) {
    return [{
      pageNumber: 1,
      content: '',
      startOffset: 0,
      endOffset: 0,
      startLine: 1,
      endLine: 1,
      title: 'Page 1',
      lineCount: 0,
      wordCount: 0,
      isOverflow: false,
      breakType: 'end'
    }];
  }

  const lines = fullContent.split('\n');
  const pages: DocumentPageItem[] = [];

  let currentPageLines: string[] = [];
  let currentPageStartOffset = 0;
  let currentPageStartLine = 1;
  let currentTitle = '';

  let currentLineNumber = 1;
  let currentOffset = 0;
  let inTable = false;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    if (trimmed.includes('|')) {
      inTable = true;
    } else if (trimmed.length === 0) {
      inTable = false;
    }

    // Explicit page break marker (---)
    const isExplicitBreak = trimmed === '---' || trimmed === '***' || trimmed === '___';
    
    // Major heading starting a new section (if page already has substantial content)
    const isMajorHeading = (trimmed.startsWith('# ') || trimmed.startsWith('## ')) && currentPageLines.length >= 22;

    // Standard A4 / Letter page sheet line capacity overflow avoiding breaking tables
    const isPageOverflow = currentPageLines.length >= linesPerPage && !inTable && !inCodeBlock && trimmed.length === 0;

    if ((isExplicitBreak || isMajorHeading || isPageOverflow) && currentPageLines.length > 0) {
      const pageContent = currentPageLines.join('\n');
      const pageEndOffset = currentOffset > 0 ? currentOffset - 1 : 0;
      const bType: 'explicit' | 'overflow' | 'heading' = isExplicitBreak ? 'explicit' : isMajorHeading ? 'heading' : 'overflow';
      const linesCount = currentPageLines.length;
      const wordsCount = pageContent.split(/\s+/).filter(Boolean).length;
      
      pages.push({
        pageNumber: pages.length + 1,
        content: pageContent,
        startOffset: currentPageStartOffset,
        endOffset: Math.max(currentPageStartOffset, pageEndOffset),
        startLine: currentPageStartLine,
        endLine: currentLineNumber - 1,
        title: currentTitle || `Page ${pages.length + 1}`,
        breakType: bType,
        lineCount: linesCount,
        wordCount: wordsCount,
        isOverflow: linesCount > linesPerPage
      });

      currentPageLines = [];
      currentPageStartOffset = currentOffset + (isExplicitBreak ? rawLine.length + 1 : 0);
      currentPageStartLine = currentLineNumber + (isExplicitBreak ? 1 : 0);
      currentTitle = '';

      if (isExplicitBreak) {
        currentOffset += rawLine.length + 1;
        currentLineNumber++;
        continue;
      }
    }

    if (trimmed.startsWith('#') && !currentTitle) {
      currentTitle = trimmed.replace(/^#+\s*/, '').slice(0, 32);
    }

    currentPageLines.push(rawLine);
    currentOffset += rawLine.length + 1;
    currentLineNumber++;
  }

  if (currentPageLines.length > 0 || pages.length === 0) {
    const pageContent = currentPageLines.join('\n');
    const linesCount = currentPageLines.length;
    const wordsCount = pageContent.split(/\s+/).filter(Boolean).length;

    pages.push({
      pageNumber: pages.length + 1,
      content: pageContent,
      startOffset: currentPageStartOffset,
      endOffset: fullContent.length,
      startLine: currentPageStartLine,
      endLine: currentLineNumber,
      title: currentTitle || `Page ${pages.length + 1}`,
      breakType: 'end',
      lineCount: linesCount,
      wordCount: wordsCount,
      isOverflow: linesCount > linesPerPage
    });
  }

  return pages;
}

export const DocumentPageView: React.FC<DocumentPageViewProps> = ({
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
  onJumpToEditor,
  filename = 'Document.docx',
  onApplyAllVerified,
  onTriggerAiScan,
  isAiScanning = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  // MS Word App Environment State
  const [activeRibbonTab, setActiveRibbonTab] = useState<WordRibbonTab>('home');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<WordViewMode>('print-layout');
  const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter');
  const [margins, setMargins] = useState<'normal' | 'narrow' | 'moderate'>('normal');
  const [fontFamily, setFontFamily] = useState<string>('Calibri');
  const [fontSize, setFontSize] = useState<number>(11);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [showBreakGuides, setShowBreakGuides] = useState<boolean>(true);
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [spreadIndex, setSpreadIndex] = useState<number>(0);

  // In-Page Direct Editing State
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string>(content);

  // Find & Replace State
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [findMatchCount, setFindMatchCount] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

  // Popover Fix Box state
  const [activePopoverIssue, setActivePopoverIssue] = useState<QAIssue | null>(null);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);

  // Photo viewer state
  const [activePhoto, setActivePhoto] = useState<{ src: string; alt: string; caption?: string } | null>(null);

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const inPageEditorRef = useRef<HTMLTextAreaElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);

  // Keep local edited text in sync when external content changes
  useEffect(() => {
    setEditedText(content);
  }, [content]);

  // Derive document title, reference, and policy for authentic running headers & footers
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

  // Calculate lines per page based on paper size & margins
  const linesPerPage = useMemo(() => {
    let base = paperSize === 'a4' ? 46 : 42;
    if (margins === 'narrow') base += 6;
    if (margins === 'moderate') base += 2;
    return base;
  }, [paperSize, margins]);

  // Split document into discrete pages
  const pages = useMemo(() => splitContentIntoPages(content, linesPerPage), [content, linesPerPage]);

  // Compute 2-page book spread pairs for Read Mode
  const spreadPairs = useMemo(() => {
    const pairs: Array<[DocumentPageItem, DocumentPageItem | null]> = [];
    for (let i = 0; i < pages.length; i += 2) {
      pairs.push([pages[i], pages[i + 1] || null]);
    }
    return pairs;
  }, [pages]);

  // Page dimensions in pixels at 96 DPI
  const paperDimensions = useMemo(() => {
    // Letter: 8.5" x 11" = 816px x 1056px
    // A4: 8.27" x 11.69" = 794px x 1123px
    if (paperSize === 'a4') {
      return { width: 794, minHeight: 1123 };
    }
    return { width: 816, minHeight: 1056 };
  }, [paperSize]);

  // Zoom scale calculations for unclipped, scrollable rendering
  const scale = zoomLevel / 100;
  const scaledWidth = Math.round(paperDimensions.width * scale);

  const handlePageContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (rulerScrollRef.current) {
      rulerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleFitToWidth = () => {
    if (!pageContainerRef.current) return;
    const containerWidth = pageContainerRef.current.clientWidth - 48; // padding margin
    const optimalZoom = Math.min(140, Math.max(60, Math.floor((containerWidth / paperDimensions.width) * 100)));
    setZoomLevel(optimalZoom);
    showStatusNotice(`Zoom adjusted to fit page width (${optimalZoom}%)`);
  };

  // Margins in pixels
  const marginPadding = useMemo(() => {
    if (margins === 'narrow') {
      return { top: 48, bottom: 48, left: 48, right: 48 }; // 0.5"
    }
    if (margins === 'moderate') {
      return { top: 96, bottom: 96, left: 72, right: 72 }; // 1.0" top/bot, 0.75" sides
    }
    return { top: 96, bottom: 96, left: 96, right: 96 }; // Normal 1.0"
  }, [margins]);

  const showStatusNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Auto-detect current page on scroll
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container || viewMode === 'web-layout') return;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      for (let p = 1; p <= pages.length; p++) {
        const pageEl = document.getElementById(`doc-word-sheet-${p}`);
        if (pageEl) {
          const rect = pageEl.getBoundingClientRect();
          if (rect.bottom > containerTop + 80) {
            setCurrentPage(p);
            break;
          }
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pages.length, viewMode]);

  // Scroll to selected issue in page view and locate its element for the floating fix box
  useEffect(() => {
    if (selectedIssueId) {
      const issue = issues.find(i => i.id === selectedIssueId);
      if (issue) {
        setActivePopoverIssue(issue);
        
        // Find which page this issue is on and update current page indicator
        const targetPage = pages.find(p => issue.startOffset >= p.startOffset && issue.startOffset <= p.endOffset);
        if (targetPage) {
          setCurrentPage(targetPage.pageNumber);
        }

        const el = document.getElementById(`page-issue-tag-${selectedIssueId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            const rect = el.getBoundingClientRect();
            setTargetRect({
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            });
          }, 120);
        } else {
          setTargetRect(null);
        }
      }
    } else {
      setActivePopoverIssue(null);
      setTargetRect(null);
    }
  }, [selectedIssueId, issues, pages]);

  // Smoothly scroll to a specific page sheet
  const scrollToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(pageNum, pages.length));
    setCurrentPage(clamped);
    const el = document.getElementById(`doc-word-sheet-${clamped}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Helper: insert formatting or apply to active selection in authentic Word document or editor
  const handleApplyFormat = (prefix: string, suffix: string = '', defaultText: string = 'text') => {
    // If user has selected text in the authentic Word page canvas
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      if (prefix === '**') {
        document.execCommand('bold');
        return;
      } else if (prefix === '*') {
        document.execCommand('italic');
        return;
      } else if (prefix === '<u>') {
        document.execCommand('underline');
        return;
      } else if (prefix === '~~') {
        document.execCommand('strikeThrough');
        return;
      }
    }

    if (!editMode) {
      setEditMode(true);
    }
    setTimeout(() => {
      const textarea = inPageEditorRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const selected = val.slice(start, end);
      const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${defaultText}${suffix}`;
      const nextVal = val.slice(0, start) + replacement + val.slice(end);

      setEditedText(nextVal);
      onChange(nextVal);

      setTimeout(() => {
        textarea.focus();
        const cursorStart = selected ? start : start + prefix.length;
        const cursorEnd = selected ? start + replacement.length : cursorStart + defaultText.length;
        textarea.setSelectionRange(cursorStart, cursorEnd);
      }, 20);
    }, 40);
  };

  const handleExecWordFormat = (cmd: string, val: string = '') => {
    document.execCommand(cmd, false, val);
  };

  const handleInsertSnippet = (snippet: string) => {
    if (editMode && inPageEditorRef.current) {
      const textarea = inPageEditorRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const nextVal = val.slice(0, start) + snippet + val.slice(end);
      setEditedText(nextVal);
      onChange(nextVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 20);
    } else {
      const updated = content + '\n\n' + snippet;
      onChange(updated);
    }
    showStatusNotice('Inserted element into Word document');
  };

  const handleInsertPageBreak = () => {
    const updated = content + '\n\n---\n<!-- Page Break -->\n\n';
    onChange(updated);
    showStatusNotice('Inserted page break (---)');
  };

  const handleInsertTable = () => {
    const tableTemplate = `\nTable: Document Summary & Metrics\n| Item / Description | Category | Baseline Target | Verified Value | Status |\n|---|---|---|---|---|\n| System Availability | Operations | 99.90% | 99.98% | Verified |\n| Latency Performance | Infrastructure | 45ms | 32ms | Verified |\n| Security Check | Compliance | Passed | Passed | Compliant |\n`;
    handleInsertSnippet(tableTemplate);
  };

  const handleAutoFormat = () => {
    const formatted = autoFormatDocumentText(content);
    onChange(formatted);
    showStatusNotice('Document formatted: tables aligned, spacing normalized');
  };

  // Find & Replace match counter
  useEffect(() => {
    if (!findQuery) {
      setFindMatchCount(0);
      return;
    }
    try {
      const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      const matches = content.match(regex);
      setFindMatchCount(matches ? matches.length : 0);
    } catch {
      setFindMatchCount(0);
    }
  }, [findQuery, content]);

  const handleReplaceAll = () => {
    if (!findQuery) return;
    try {
      const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      const updated = content.replace(regex, replaceQuery);
      onChange(updated);
      showStatusNotice(`Replaced ${findMatchCount} occurrences`);
    } catch (err) {
      console.error(err);
    }
  };

  // Apply fix directly from the floating box
  const handleApplyFixInternal = (issue: QAIssue) => {
    if (onApplyFix) {
      onApplyFix(issue);
    } else if (issue.startOffset >= 0 && issue.endOffset <= content.length) {
      const updated = content.slice(0, issue.startOffset) + issue.suggestedText + content.slice(issue.endOffset);
      onChange(updated);
    }
    setActivePopoverIssue(null);
    setTargetRect(null);
    onSelectIssue(null);
  };

  const handleApplyManualFixInternal = (issue: QAIssue, replacement: string) => {
    if (onApplyManualFix) {
      onApplyManualFix(issue, replacement);
    } else if (issue.startOffset >= 0 && issue.endOffset <= content.length) {
      const updated = content.slice(0, issue.startOffset) + replacement + content.slice(issue.endOffset);
      onChange(updated);
    }
    setActivePopoverIssue(null);
    setTargetRect(null);
    onSelectIssue(null);
  };

  const handleCommitEdit = () => {
    onChange(editedText);
    setEditMode(false);
    showStatusNotice('Revisions saved to Word document');
  };

  const handleCancelEdit = () => {
    setEditedText(content);
    setEditMode(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#f3f2f1] text-[#323130] overflow-hidden select-text relative font-['Segoe_UI',Calibri,Arial,sans-serif]">
      
      {/* ========================================================================= */}
      {/* 1. AUTHENTIC MICROSOFT WORD TITLE BAR                                     */}
      {/* ========================================================================= */}
      <div className="bg-[#185abd] text-white px-3 py-1.5 flex items-center justify-between gap-3 text-xs select-none shadow-xs shrink-0 z-20">
        {/* Left: Quick Access Toolbar & AutoSave */}
        <div className="flex items-center gap-2.5">
          {/* Word App Logo */}
          <div className="w-5 h-5 bg-white text-[#185abd] font-bold rounded-xs flex items-center justify-center text-xs shadow-2xs font-serif">
            W
          </div>

          {/* AutoSave Toggle Badge */}
          <div className="flex items-center gap-1.5 bg-[#0f4c81]/80 px-2 py-0.5 rounded-full border border-blue-300/30 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-blue-100">AutoSave</span>
            <span className="text-[10px] text-emerald-300 font-bold">On</span>
          </div>

          {/* Quick Save */}
          <button 
            onClick={() => showStatusNotice('Document auto-saved & synchronized')}
            className="p-1 hover:bg-[#104a7b] rounded transition text-blue-100 hover:text-white"
            title="Save Document (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
          </button>

          {/* Undo */}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1 rounded transition ${canUndo ? 'hover:bg-[#104a7b] text-white' : 'text-blue-300/40 cursor-not-allowed'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Redo */}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1 rounded transition ${canRedo ? 'hover:bg-[#104a7b] text-white' : 'text-blue-300/40 cursor-not-allowed'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Center: Document Title & Search Bar */}
        <div className="flex items-center gap-2 max-w-md w-full justify-center">
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-tight truncate">
            <span className="truncate">{filename}</span>
            <span className="text-blue-200 text-[11px]">- Word</span>
            <span className="text-[10px] text-blue-200 bg-[#0f4c81]/60 px-1.5 py-0.2 rounded font-normal">Saved</span>
          </div>

          {/* MS Word Tell Me / Search Box */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[#0f4c81]/90 hover:bg-[#0c3f6c] border border-blue-400/30 rounded-md px-2.5 py-0.5 text-blue-100 text-[11px] w-48 transition cursor-text"
               onClick={() => setShowFindReplace(true)}>
            <Search className="w-3 h-3 text-blue-200" />
            <span>Search (Alt+Q)</span>
          </div>
        </div>

        {/* Right: Mode Badge & Window Controls */}
        <div className="flex items-center gap-2">
          {/* Direct Page Edit Toggle Button */}
          {editMode ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCommitEdit}
                className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-[11px] flex items-center gap-1 transition shadow-xs"
              >
                <Check className="w-3 h-3" />
                <span>Finish Edit</span>
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded font-medium text-[11px] transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-2 py-0.5 bg-white/15 hover:bg-white/25 text-white rounded font-semibold text-[11px] flex items-center gap-1 transition border border-white/20"
              title="Edit document content directly inside the Word page sheets"
            >
              <Edit3 className="w-3 h-3 text-blue-100" />
              <span>Edit Document</span>
            </button>
          )}

          {/* Quick Download Word file */}
          <button
            onClick={async () => {
              const buf = await createStandardDocxPackage(content, {
                title: docTitle,
                headerText: effectiveHeader,
                footerText: effectiveFooter,
              });
              downloadDocxFile(buf, filename);
              showStatusNotice(`Downloaded ${filename}`);
            }}
            className="p-1 hover:bg-[#104a7b] rounded text-blue-100 hover:text-white transition"
            title="Download .docx file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. AUTHENTIC MICROSOFT WORD RIBBON                                        */}
      {/* ========================================================================= */}
      <div className="bg-white border-b border-[#e1dfdd] shadow-2xs select-none shrink-0 z-10">
        
        {/* Ribbon Tab Strip */}
        <div className="flex items-center justify-between px-3 border-b border-[#edebe9] bg-[#f8f9fa] text-xs">
          <div className="flex items-center gap-0.5">
            {/* File Button (Word Blue) */}
            <button
              onClick={() => {
                setActiveRibbonTab('home');
                showStatusNotice('Word File actions: Save, Export, Print');
              }}
              className="px-3 py-1 font-semibold text-[#185abd] hover:bg-blue-50 rounded-t transition"
            >
              File
            </button>

            {/* Home Tab */}
            <button
              onClick={() => setActiveRibbonTab('home')}
              className={`px-3 py-1.5 font-semibold transition border-b-2 ${
                activeRibbonTab === 'home'
                  ? 'border-[#185abd] text-[#185abd] bg-white'
                  : 'border-transparent text-[#323130] hover:bg-slate-100/80'
              }`}
            >
              Home
            </button>

            {/* Insert Tab */}
            <button
              onClick={() => setActiveRibbonTab('insert')}
              className={`px-3 py-1.5 font-semibold transition border-b-2 ${
                activeRibbonTab === 'insert'
                  ? 'border-[#185abd] text-[#185abd] bg-white'
                  : 'border-transparent text-[#323130] hover:bg-slate-100/80'
              }`}
            >
              Insert
            </button>

            {/* Layout Tab */}
            <button
              onClick={() => setActiveRibbonTab('layout')}
              className={`px-3 py-1.5 font-semibold transition border-b-2 ${
                activeRibbonTab === 'layout'
                  ? 'border-[#185abd] text-[#185abd] bg-white'
                  : 'border-transparent text-[#323130] hover:bg-slate-100/80'
              }`}
            >
              Layout
            </button>

            {/* Review Tab */}
            <button
              onClick={() => setActiveRibbonTab('review')}
              className={`px-3 py-1.5 font-semibold transition border-b-2 ${
                activeRibbonTab === 'review'
                  ? 'border-[#185abd] text-[#185abd] bg-white'
                  : 'border-transparent text-[#323130] hover:bg-slate-100/80'
              }`}
            >
              Review
              {issues.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-bold">
                  {issues.length}
                </span>
              )}
            </button>

            {/* View Tab */}
            <button
              onClick={() => setActiveRibbonTab('view')}
              className={`px-3 py-1.5 font-semibold transition border-b-2 ${
                activeRibbonTab === 'view'
                  ? 'border-[#185abd] text-[#185abd] bg-white'
                  : 'border-transparent text-[#323130] hover:bg-slate-100/80'
              }`}
            >
              View
            </button>
          </div>

          {/* Ribbon Collapse / Expand Toggle Chevron */}
          <button
            onClick={() => setIsRibbonCollapsed(prev => !prev)}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded transition"
            title={isRibbonCollapsed ? 'Expand Ribbon' : 'Collapse Ribbon'}
          >
            {isRibbonCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Ribbon Commands Toolbar (Collapsible) */}
        {!isRibbonCollapsed && (
          <div className="px-3 py-1.5 bg-white flex items-center justify-between gap-4 overflow-x-auto text-xs min-h-[52px]">
            
            {/* TAB: HOME */}
            {activeRibbonTab === 'home' && (
              <div className="flex items-center gap-3 divide-x divide-[#edebe9] flex-nowrap">
                {/* Font Group */}
                <div className="flex items-center gap-1.5 pr-3">
                  {/* Font Family Dropdown */}
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="bg-[#f8f9fa] border border-[#d2d0ce] hover:border-[#8a8886] rounded px-2 py-1 text-xs font-medium text-[#323130] outline-hidden focus:border-[#185abd] w-28 sm:w-32"
                    title="Font Family"
                  >
                    <option value="Calibri">Calibri</option>
                    <option value="Carlito">Carlito (Calibri)</option>
                    <option value="Aptos">Aptos</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Segoe UI">Segoe UI</option>
                    <option value="Georgia">Georgia</option>
                  </select>

                  {/* Font Size Dropdown */}
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="bg-[#f8f9fa] border border-[#d2d0ce] hover:border-[#8a8886] rounded px-1.5 py-1 text-xs font-bold text-[#323130] outline-hidden focus:border-[#185abd] w-14"
                    title="Font Size (pt)"
                  >
                    {[9, 10, 11, 12, 14, 16, 18, 20, 24].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>

                  {/* Bold, Italic, Underline, Strikethrough */}
                  <div className="flex items-center gap-0.5 ml-1">
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleApplyFormat('**', '**', 'Bold Text')} 
                      className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 font-bold text-xs w-6 h-6 flex items-center justify-center transition" 
                      title="Bold (Ctrl+B)"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleApplyFormat('*', '*', 'Italic Text')} 
                      className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 italic text-xs w-6 h-6 flex items-center justify-center transition" 
                      title="Italic (Ctrl+I)"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleApplyFormat('<u>', '</u>', 'Underlined Text')} 
                      className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 text-xs w-6 h-6 flex items-center justify-center transition" 
                      title="Underline (Ctrl+U)"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleApplyFormat('~~', '~~', 'Strikethrough Text')} 
                      className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 text-xs w-6 h-6 flex items-center justify-center transition" 
                      title="Strikethrough"
                    >
                      <Strikethrough className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Paragraph Group */}
                <div className="flex items-center gap-1 px-3">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleExecWordFormat('insertUnorderedList');
                      handleInsertSnippet('- Bullet Item 1\n- Bullet Item 2');
                    }} 
                    className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition" 
                    title="Bullets"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleExecWordFormat('insertOrderedList');
                      handleInsertSnippet('1. Numbered Item 1\n2. Numbered Item 2');
                    }} 
                    className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition" 
                    title="Numbering"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                  <div className="h-4 w-px bg-slate-200 mx-0.5" />
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleExecWordFormat('justifyLeft');
                      showStatusNotice('Alignment: Left');
                    }}
                    className="p-1 bg-blue-50 text-blue-700 rounded w-6 h-6 flex items-center justify-center transition" 
                    title="Align Left (Ctrl+L)"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleExecWordFormat('justifyCenter');
                      showStatusNotice('Alignment: Center');
                    }}
                    className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition" 
                    title="Center (Ctrl+E)"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleExecWordFormat('justifyRight');
                      showStatusNotice('Alignment: Right');
                    }}
                    className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition" 
                    title="Align Right (Ctrl+R)"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleExecWordFormat('justifyFull');
                      showStatusNotice('Alignment: Justify');
                    }}
                    className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition" 
                    title="Justify (Ctrl+J)"
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Styles Gallery (Word Signature Feature) */}
                <div className="flex items-center gap-1.5 px-3">
                  <button
                    onClick={() => handleInsertSnippet('\nNormal body paragraph content formatted in Calibri 11pt.\n')}
                    className="px-2 py-1 bg-[#f8f9fa] hover:bg-blue-50 hover:border-blue-300 border border-[#d2d0ce] rounded text-left transition"
                    title="Apply Normal Style"
                  >
                    <span className="block text-[11px] font-medium text-slate-800">Normal</span>
                    <span className="block text-[9px] text-slate-400 font-mono">Calibri 11pt</span>
                  </button>

                  <button
                    onClick={() => handleInsertSnippet('\n# Executive Section Title\n')}
                    className="px-2 py-1 bg-[#f8f9fa] hover:bg-blue-50 hover:border-blue-300 border border-[#d2d0ce] rounded text-left transition"
                    title="Apply Heading 1"
                  >
                    <span className="block text-[11px] font-bold text-[#1f3864]">Heading 1</span>
                    <span className="block text-[9px] text-[#2f5496] font-mono">18pt Bold</span>
                  </button>

                  <button
                    onClick={() => handleInsertSnippet('\n## Operational Sub-Heading\n')}
                    className="px-2 py-1 bg-[#f8f9fa] hover:bg-blue-50 hover:border-blue-300 border border-[#d2d0ce] rounded text-left transition hidden sm:block"
                    title="Apply Heading 2"
                  >
                    <span className="block text-[11px] font-bold text-[#2f5496]">Heading 2</span>
                    <span className="block text-[9px] text-slate-500 font-mono">13pt Bold</span>
                  </button>
                </div>

                {/* Editing Tools */}
                <div className="flex items-center gap-1.5 pl-3">
                  <button
                    onClick={() => setShowFindReplace(prev => !prev)}
                    className={`px-2 py-1 rounded border text-xs font-semibold flex items-center gap-1 transition ${
                      showFindReplace ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-[#f8f9fa] hover:bg-slate-100 text-slate-700 border-[#d2d0ce]'
                    }`}
                    title="Find and Replace"
                  >
                    <Search className="w-3.5 h-3.5 text-blue-600" />
                    <span>Find</span>
                  </button>

                  <button
                    onClick={handleAutoFormat}
                    className="px-2 py-1 bg-[#f8f9fa] hover:bg-indigo-50 hover:border-indigo-300 border border-[#d2d0ce] text-indigo-900 rounded text-xs font-semibold flex items-center gap-1 transition"
                    title="Auto-format and align document"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden md:inline">Align</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: INSERT */}
            {activeRibbonTab === 'insert' && (
              <div className="flex items-center gap-3 divide-x divide-[#edebe9] flex-nowrap">
                <div className="flex items-center gap-2 pr-3">
                  <button
                    onClick={handleInsertTable}
                    className="px-2.5 py-1.5 bg-[#f8f9fa] hover:bg-blue-50 hover:border-blue-300 border border-[#d2d0ce] rounded text-slate-700 flex items-center gap-1.5 text-xs font-semibold transition"
                    title="Insert Microsoft Word Table Grid"
                  >
                    <TableIcon className="w-4 h-4 text-blue-600" />
                    <span>Table</span>
                  </button>

                  <button
                    onClick={handleInsertPageBreak}
                    className="px-2.5 py-1.5 bg-[#f8f9fa] hover:bg-blue-50 hover:border-blue-300 border border-[#d2d0ce] rounded text-slate-700 flex items-center gap-1.5 text-xs font-semibold transition"
                    title="Insert Page Break (---)"
                  >
                    <Scissors className="w-4 h-4 text-blue-600" />
                    <span>Page Break</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 px-3">
                  {onOpenHeaderFooterModal && (
                    <button
                      onClick={onOpenHeaderFooterModal}
                      className="px-2.5 py-1.5 bg-[#f8f9fa] hover:bg-blue-50 hover:border-blue-300 border border-[#d2d0ce] rounded text-slate-700 flex items-center gap-1.5 text-xs font-semibold transition"
                      title="Configure Running Header and Footer"
                    >
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span>Header &amp; Footer</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleInsertSnippet('> **Official Assessment Notice:** This assessment certificate is sealed under statutory rules.\n')}
                    className="px-2.5 py-1.5 bg-[#f8f9fa] hover:bg-blue-50 hover:border-blue-300 border border-[#d2d0ce] rounded text-slate-700 flex items-center gap-1.5 text-xs font-semibold transition"
                    title="Insert Callout Quote Box"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Callout Box</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: LAYOUT */}
            {activeRibbonTab === 'layout' && (
              <div className="flex items-center gap-4 divide-x divide-[#edebe9] flex-nowrap">
                {/* Margins */}
                <div className="flex items-center gap-1.5 pr-3">
                  <span className="text-[11px] font-semibold text-slate-600">Margins:</span>
                  <div className="flex items-center bg-[#f8f9fa] rounded-md p-0.5 border border-[#d2d0ce]">
                    <button
                      onClick={() => setMargins('normal')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        margins === 'normal' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Normal 1.0 inch margins on all sides"
                    >
                      Normal (1.0")
                    </button>
                    <button
                      onClick={() => setMargins('narrow')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        margins === 'narrow' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Narrow 0.5 inch margins"
                    >
                      Narrow (0.5")
                    </button>
                    <button
                      onClick={() => setMargins('moderate')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        margins === 'moderate' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Moderate margins: 1.0 inch top/bottom, 0.75 inch sides"
                    >
                      Moderate
                    </button>
                  </div>
                </div>

                {/* Paper Size */}
                <div className="flex items-center gap-1.5 px-3">
                  <span className="text-[11px] font-semibold text-slate-600">Size:</span>
                  <div className="flex items-center bg-[#f8f9fa] rounded-md p-0.5 border border-[#d2d0ce]">
                    <button
                      onClick={() => setPaperSize('letter')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        paperSize === 'letter' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Letter Paper Size (8.5 x 11 inches)"
                    >
                      Letter
                    </button>
                    <button
                      onClick={() => setPaperSize('a4')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        paperSize === 'a4' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="A4 Paper Size (210 x 297 mm)"
                    >
                      A4
                    </button>
                  </div>
                </div>

                {/* Show Margin Guides */}
                <div className="flex items-center gap-2 pl-3">
                  <button
                    onClick={() => setShowMarginGuides(prev => !prev)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                      showMarginGuides ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-[#f8f9fa] text-slate-600 border-[#d2d0ce]'
                    }`}
                  >
                    <span>Margin Guides</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: REVIEW */}
            {activeRibbonTab === 'review' && (
              <div className="flex items-center gap-3 divide-x divide-[#edebe9] flex-nowrap">
                <div className="flex items-center gap-2 pr-3">
                  <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md text-xs">
                    <FileCheck2 className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-blue-900">DocuVerify QA Audit:</span>
                    <span className={`px-1.5 py-0.2 rounded-full font-bold text-[10px] ${
                      issues.length > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                      {issues.length > 0 ? `${issues.length} Issues` : '✓ All Clear'}
                    </span>
                  </div>

                  {onApplyAllVerified && issues.length > 0 && (
                    <button
                      onClick={onApplyAllVerified}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1 transition shadow-xs"
                      title="Apply all verified QA corrections in one pass"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Accept All Fixes</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 px-3">
                  {onTriggerAiScan && (
                    <button
                      onClick={onTriggerAiScan}
                      disabled={isAiScanning}
                      className="px-3 py-1 bg-[#185abd] hover:bg-[#104a7b] text-white rounded font-bold text-xs flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                      title="Run Gemini 3.8 Flash AI Extended Deep Audit"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                      <span>{isAiScanning ? 'Scanning...' : 'AI Deep Scan'}</span>
                    </button>
                  )}

                  <div className="text-xs text-slate-500">
                    Quality Score: <strong className="text-slate-800">{stats.qualityScore}%</strong>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: VIEW */}
            {activeRibbonTab === 'view' && (
              <div className="flex items-center gap-4 divide-x divide-[#edebe9] flex-nowrap">
                {/* Views Selector */}
                <div className="flex items-center gap-1 pr-3">
                  <div className="flex items-center bg-[#f8f9fa] rounded-md p-0.5 border border-[#d2d0ce]">
                    <button
                      onClick={() => setViewMode('print-layout')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                        viewMode === 'print-layout' ? 'bg-white text-[#185abd] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Print Layout - Authentic Microsoft Word Page Sheets"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Print Layout</span>
                    </button>

                    <button
                      onClick={() => setViewMode('read-mode')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                        viewMode === 'read-mode' ? 'bg-white text-[#185abd] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Read Mode - Two-page side-by-side book spread"
                    >
                      <Columns2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Read Mode</span>
                    </button>

                    <button
                      onClick={() => setViewMode('web-layout')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                        viewMode === 'web-layout' ? 'bg-white text-[#185abd] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Web Layout - Continuous flowing document"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Web Layout</span>
                    </button>

                    {docxBuffer && (
                      <button
                        onClick={() => setViewMode('raw-openxml')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                          viewMode === 'raw-openxml' ? 'bg-white text-[#185abd] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Raw OpenXML Engine - Native binary DOCX package renderer"
                      >
                        <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                        <span>OpenXML Engine</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Show/Hide Toggles */}
                <div className="flex items-center gap-2 px-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showRuler}
                      onChange={(e) => setShowRuler(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Ruler</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showBreakGuides}
                      onChange={(e) => setShowBreakGuides(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Page Break Guides</span>
                  </label>
                </div>

                {/* Zoom Presets */}
                <div className="flex items-center gap-1.5 pl-3">
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="px-2 py-0.5 bg-[#f8f9fa] hover:bg-slate-100 border border-[#d2d0ce] rounded text-xs font-bold text-slate-700"
                    title="Zoom 100%"
                  >
                    100%
                  </button>
                  <button
                    onClick={() => setZoomLevel(120)}
                    className="px-2 py-0.5 bg-[#f8f9fa] hover:bg-slate-100 border border-[#d2d0ce] rounded text-xs font-medium text-slate-700"
                    title="Zoom Page Width (120%)"
                  >
                    Page Width
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Find & Replace Bar (If Active) */}
      {showFindReplace && (
        <div className="px-4 py-2 border-b border-[#d2d0ce] bg-[#f8f9fa] flex flex-wrap items-center gap-2 text-xs z-10">
          <div className="flex items-center gap-1.5 bg-white border border-[#d2d0ce] rounded px-2 py-1">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Find in Word doc..."
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              className="outline-hidden text-slate-800 w-36 sm:w-48 text-xs"
              autoFocus
            />
            {findQuery && (
              <span className="text-[10px] text-slate-500 font-mono">
                {findMatchCount} {findMatchCount === 1 ? 'match' : 'matches'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-[#d2d0ce] rounded px-2 py-1">
            <Replace className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="outline-hidden text-slate-800 w-36 sm:w-48 text-xs"
            />
          </div>

          <button
            onClick={handleReplaceAll}
            disabled={!findQuery || findMatchCount === 0}
            className="px-3 py-1 bg-[#185abd] hover:bg-[#104a7b] text-white rounded font-semibold text-xs transition disabled:opacity-50"
          >
            Replace All
          </button>

          <button
            onClick={() => setShowFindReplace(false)}
            className="p-1 text-slate-400 hover:text-slate-700 ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 z-10 animate-in fade-in duration-100">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. AUTHENTIC MICROSOFT WORD DUAL RULER                                    */}
      {/* ========================================================================= */}
      {showRuler && (
        <div 
          ref={rulerScrollRef}
          className="w-full bg-[#f3f2f1] border-b border-[#d2d0ce] overflow-x-hidden select-none shrink-0 z-10 py-0.5"
        >
          <div 
            style={{ minWidth: `${scaledWidth + 48}px` }}
            className="w-full flex justify-center"
          >
            <div 
              style={{ width: `${scaledWidth}px`, minWidth: `${scaledWidth}px` }}
              className="relative overflow-hidden"
            >
              <div 
                style={{ width: `${paperDimensions.width}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="h-5 bg-white border border-[#d2d0ce] shadow-2xs relative flex items-center text-[9px] font-mono text-slate-600"
              >
                {/* Left Margin Gray Zone */}
                <div 
                  style={{ width: marginPadding.left }}
                  className="h-full bg-[#e1dfdd] border-r border-[#8a8886] relative flex items-center justify-end pr-1 text-[8px] text-slate-500"
                >
                  {/* Left Margin Indent Marker */}
                  <div className="absolute -bottom-1 left-2 w-0 h-0 border-x-4 border-x-transparent border-b-6 border-b-slate-700" title="First Line Indent" />
                </div>

                {/* Printable White Ruler Zone with Numbered Inch Graduation Ticks */}
                <div className="flex-1 h-full bg-white relative flex items-center">
                  {Array.from({ length: 8 }).map((_, inchIdx) => (
                    <div 
                      key={`inch-${inchIdx}`} 
                      style={{ left: `${(inchIdx + 1) * 96}px` }}
                      className="absolute top-0 bottom-0 flex flex-col items-center justify-between"
                    >
                      <span className="text-[9px] font-semibold text-slate-700 leading-none pt-0.5">{inchIdx + 1}</span>
                      <div className="w-px h-2 bg-slate-400" />
                    </div>
                  ))}
                  {/* Half-inch ticks */}
                  {Array.from({ length: 8 }).map((_, halfIdx) => (
                    <div 
                      key={`half-${halfIdx}`} 
                      style={{ left: `${halfIdx * 96 + 48}px` }}
                      className="absolute bottom-0 w-px h-1.5 bg-slate-300"
                    />
                  ))}
                </div>

                {/* Right Margin Gray Zone */}
                <div 
                  style={{ width: marginPadding.right }}
                  className="h-full bg-[#e1dfdd] border-l border-[#8a8886] relative flex items-center pl-1 text-[8px] text-slate-500"
                >
                  {/* Right Margin Stop */}
                  <div className="absolute -bottom-1 right-2 w-0 h-0 border-x-4 border-x-transparent border-b-6 border-b-slate-700" title="Right Margin Stop" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MAIN DOCUMENT CANVAS ("WORD DESK")                                     */}
      {/* ========================================================================= */}
      <div 
        ref={pageContainerRef}
        onScroll={handlePageContainerScroll}
        className="flex-1 overflow-x-auto overflow-y-auto p-2 sm:p-4 md:p-6 scroll-smooth bg-[#f3f2f1] relative select-text"
        onClick={() => {
          if (activePopoverIssue) {
            setActivePopoverIssue(null);
            setTargetRect(null);
            onSelectIssue(null);
          }
        }}
      >
        <div 
          style={{ minWidth: `${scaledWidth + 48}px` }}
          className="w-full min-h-full flex flex-col items-center pb-24"
        >
          <div 
            style={{ width: `${scaledWidth}px`, minWidth: `${scaledWidth}px` }}
            className="flex flex-col items-center relative"
          >
            <div 
              style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${paperDimensions.width}px` }}
              className="transition-transform duration-150 flex flex-col items-center"
            >
          {/* VIEW: AUTHENTIC MICROSOFT WORD OPENXML ENGINE (PRIMARY WHEN DOCX BUFFER IS PRESENT) */}
          {docxBuffer && viewMode !== 'read-mode' && viewMode !== 'web-layout' ? (
            <div className="w-full flex flex-col items-center">
              <WordDocumentViewer
                docxBuffer={docxBuffer}
                onDocxBufferChange={onDocxBufferChange}
                issues={issues}
                selectedIssueId={selectedIssueId}
                onSelectIssue={(issue, rect) => {
                  onSelectIssue(issue.id);
                  setActivePopoverIssue(issue);
                  setTargetRect(rect);
                }}
                zoomLevel={100}
                onPageChange={(curr, total) => {
                  setCurrentPage(curr);
                }}
                onContentChange={(newText) => {
                  onChange(newText);
                }}
                onOpenHeaderFooterModal={onOpenHeaderFooterModal}
                onApplyFix={handleApplyFixInternal}
                headerText={headerText}
                footerText={footerText}
                isEditable={true}
              />
            </div>
          ) : viewMode === 'read-mode' ? (
            /* VIEW: READ MODE (TWO-PAGE SIDE-BY-SIDE BOOK SPREAD) */
            <div className="space-y-6 max-w-6xl w-full">
              {/* Spread Navigator */}
              <div className="bg-white p-2.5 rounded-lg border border-[#d2d0ce] shadow-xs flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSpreadIndex(prev => Math.max(0, prev - 1))}
                    disabled={spreadIndex === 0}
                    className={`px-3 py-1 rounded font-semibold flex items-center gap-1 border transition ${
                      spreadIndex === 0 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous Spread</span>
                  </button>
                  <span className="font-mono text-xs font-bold text-slate-800 px-2">
                    Spread {spreadIndex + 1} of {spreadPairs.length}
                  </span>
                  <button
                    onClick={() => setSpreadIndex(prev => Math.min(spreadPairs.length - 1, prev + 1))}
                    disabled={spreadIndex >= spreadPairs.length - 1}
                    className={`px-3 py-1 rounded font-semibold flex items-center gap-1 border transition ${
                      spreadIndex >= spreadPairs.length - 1 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                    }`}
                  >
                    <span>Next Spread</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-slate-500 font-medium">
                  Viewing Pages {spreadPairs[spreadIndex]?.[0]?.pageNumber} &amp; {spreadPairs[spreadIndex]?.[1]?.pageNumber || 'Blank'} of {pages.length}
                </div>
              </div>

              {/* Side-by-side spread pages */}
              {spreadPairs[spreadIndex] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">
                  {/* Left Page (Verso) */}
                  {(() => {
                    const leftPage = spreadPairs[spreadIndex][0];
                    const leftIssues = issues.filter(iss => iss.startOffset < leftPage.endOffset && iss.endOffset >= leftPage.startOffset);
                    return (
                      <div 
                        key={`spread-left-${leftPage.pageNumber}`}
                        className="bg-white rounded-xs shadow-[0_4px_18px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)] border border-[#d2d0ce] min-h-[950px] p-8 sm:p-12 flex flex-col relative text-[#1e293b]"
                        style={{ fontFamily }}
                      >
                        <div className="border-b border-[#cbd5e1] pb-2 mb-6 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-[#1f3864] truncate max-w-[70%]">{effectiveHeader}</span>
                          <span className="font-mono text-slate-600 font-semibold">Page {leftPage.pageNumber}</span>
                        </div>
                        <div className="flex-1 text-[14.6px] leading-[1.25]">
                          <RenderDocumentPageStructure
                            content={leftPage.content}
                            pageBaseOffset={leftPage.startOffset}
                            issues={leftIssues}
                            selectedIssueId={selectedIssueId}
                            fontFamily={fontFamily}
                            fontSize={fontSize}
                            onSelectIssue={(issue, rect) => {
                              onSelectIssue(issue.id);
                              setActivePopoverIssue(issue);
                              setTargetRect(rect);
                            }}
                            onPhotoClick={(photo) => setActivePhoto(photo)}
                          />
                        </div>
                        <div className="border-t border-[#cbd5e1] pt-2.5 mt-8 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[70%]">{effectiveFooter}</span>
                          <span className="font-mono font-bold text-slate-700">P. {leftPage.pageNumber}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Right Page (Recto) */}
                  {(() => {
                    const rightPage = spreadPairs[spreadIndex][1];
                    if (!rightPage) {
                      return (
                        <div className="bg-slate-50/60 rounded-xs border-2 border-dashed border-[#d2d0ce] min-h-[950px] p-8 flex flex-col items-center justify-center text-slate-400">
                          <FileText className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
                          <p className="text-sm font-semibold">End of Document</p>
                          <p className="text-xs text-slate-400">No facing page</p>
                        </div>
                      );
                    }
                    const rightIssues = issues.filter(iss => iss.startOffset < rightPage.endOffset && iss.endOffset >= rightPage.startOffset);
                    return (
                      <div 
                        key={`spread-right-${rightPage.pageNumber}`}
                        className="bg-white rounded-xs shadow-[0_4px_18px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)] border border-[#d2d0ce] min-h-[950px] p-8 sm:p-12 flex flex-col relative text-[#1e293b]"
                        style={{ fontFamily }}
                      >
                        <div className="border-b border-[#cbd5e1] pb-2 mb-6 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-[#1f3864] truncate max-w-[70%]">{effectiveHeader}</span>
                          <span className="font-mono text-slate-600 font-semibold">Page {rightPage.pageNumber}</span>
                        </div>
                        <div className="flex-1 text-[14.6px] leading-[1.25]">
                          <RenderDocumentPageStructure
                            content={rightPage.content}
                            pageBaseOffset={rightPage.startOffset}
                            issues={rightIssues}
                            selectedIssueId={selectedIssueId}
                            fontFamily={fontFamily}
                            fontSize={fontSize}
                            onSelectIssue={(issue, rect) => {
                              onSelectIssue(issue.id);
                              setActivePopoverIssue(issue);
                              setTargetRect(rect);
                            }}
                            onPhotoClick={(photo) => setActivePhoto(photo)}
                          />
                        </div>
                        <div className="border-t border-[#cbd5e1] pt-2.5 mt-8 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[70%]">{effectiveFooter}</span>
                          <span className="font-mono font-bold text-slate-700">P. {rightPage.pageNumber}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : viewMode === 'web-layout' ? (
            /* VIEW: WEB LAYOUT (CONTINUOUS FLOW) */
            <div 
              style={{ width: paperDimensions.width, fontFamily }}
              className="bg-white rounded-xs shadow-[0_4px_18px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)] border border-[#d2d0ce] min-h-[1050px] p-8 sm:p-14 md:p-16 flex flex-col relative text-[#1e293b]"
            >
              {/* Running Header */}
              <div className="border-b border-[#cbd5e1] pb-2.5 mb-8 flex items-center justify-between text-[11px] text-slate-500 select-none">
                <span className="font-bold text-[#1f3864] tracking-tight truncate max-w-[70%]">{effectiveHeader}</span>
                <span className="text-slate-400 font-medium">Web Layout (Continuous Flow)</span>
              </div>

              {/* Document Content */}
              <div className="flex-1 text-[14.6px] leading-[1.25]">
                <RenderDocumentPageStructure
                  content={content}
                  pageBaseOffset={0}
                  issues={issues}
                  selectedIssueId={selectedIssueId}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  onSelectIssue={(issue, rect) => {
                    onSelectIssue(issue.id);
                    setActivePopoverIssue(issue);
                    setTargetRect(rect);
                  }}
                  onPhotoClick={(photo) => setActivePhoto(photo)}
                />
              </div>

              {/* Running Footer */}
              <div className="border-t border-[#cbd5e1] pt-3 mt-12 flex items-center justify-between text-[11px] text-slate-500 select-none">
                <span className="font-medium text-slate-600 truncate max-w-[70%]">{effectiveFooter}</span>
                <span className="font-mono text-slate-500">Continuous Document</span>
              </div>
            </div>
          ) : (
            /* VIEW: PRINT LAYOUT (AUTHENTIC MICROSOFT WORD PHYSICAL PAGES) */
            <div className="space-y-8 flex flex-col items-center">
              {pages.map((page, pageIdx) => {
                const pageIssues = issues.filter(
                  iss => iss.startOffset < page.endOffset && iss.endOffset >= page.startOffset
                );

                return (
                  <React.Fragment key={`doc-word-fragment-${page.pageNumber}`}>
                    {/* The Microsoft Word Physical Page Sheet */}
                    <div 
                      key={`doc-word-sheet-${page.pageNumber}`}
                      id={`doc-word-sheet-${page.pageNumber}`}
                      style={{ 
                        width: paperDimensions.width, 
                        minHeight: paperDimensions.minHeight,
                        paddingTop: `${marginPadding.top}px`,
                        paddingBottom: `${marginPadding.bottom}px`,
                        paddingLeft: `${marginPadding.left}px`,
                        paddingRight: `${marginPadding.right}px`,
                        fontFamily,
                      }}
                      className="bg-white rounded-xs shadow-[0_4px_18px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)] border border-[#d2d0ce] flex flex-col relative text-[#1e293b] transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)] group"
                    >
                      {/* Margin Boundary Guides (Optional Visual Aid) */}
                      {showMarginGuides && (
                        <div 
                          style={{
                            top: `${marginPadding.top}px`,
                            bottom: `${marginPadding.bottom}px`,
                            left: `${marginPadding.left}px`,
                            right: `${marginPadding.right}px`,
                          }}
                          className="absolute border border-dashed border-blue-300/60 pointer-events-none z-0"
                        />
                      )}

                      {/* Running Header inside Top Margin Zone */}
                      <div 
                        style={{ top: '24px', left: `${marginPadding.left}px`, right: `${marginPadding.right}px` }}
                        onClick={() => {
                          if (onOpenHeaderFooterModal) onOpenHeaderFooterModal();
                        }}
                        className="absolute flex items-center justify-between text-[11px] text-[#64748b] select-none border-b border-[#cbd5e1] pb-1.5 cursor-pointer hover:bg-blue-50/60 transition rounded px-1 group/hdr"
                        title="Click to edit Running Header"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[75%]">
                          <span className="font-bold text-[#1f3864] tracking-tight truncate">{effectiveHeader}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onOpenHeaderFooterModal && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenHeaderFooterModal();
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold transition flex items-center gap-1 bg-white/80 px-1.5 py-0.5 rounded border border-blue-200"
                              title="Edit Running Header"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>Edit Header</span>
                            </button>
                          )}
                          <span className="font-medium text-[10px] text-slate-400">Header -Section 1-</span>
                        </div>
                      </div>

                      {/* Main Word Page Document Body */}
                      <div className="flex-1 text-[14.6px] leading-[1.25] relative z-1">
                        {editMode && currentPage === page.pageNumber ? (
                          /* Direct In-Place Word Page Editor */
                          <div className="h-full flex flex-col">
                            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2 shadow-2xs">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                <span className="font-semibold">In-Page Word Editor (Page {page.pageNumber})</span>
                                <span className="text-[11px] text-blue-700 hidden sm:inline">• Ctrl+B Bold, Ctrl+I Italic, Ctrl+U Underline</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded font-medium text-xs transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleCommitEdit}
                                  className="px-3 py-1 bg-[#185abd] hover:bg-[#104a7b] text-white rounded font-bold text-xs flex items-center gap-1 transition shadow-xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Save Revisions</span>
                                </button>
                              </div>
                            </div>
                            <textarea
                              ref={inPageEditorRef}
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                  if (e.key === 'b' || e.key === 'B') {
                                    e.preventDefault();
                                    handleApplyFormat('**', '**', 'Bold Text');
                                  } else if (e.key === 'i' || e.key === 'I') {
                                    e.preventDefault();
                                    handleApplyFormat('*', '*', 'Italic Text');
                                  } else if (e.key === 'u' || e.key === 'U') {
                                    e.preventDefault();
                                    handleApplyFormat('<u>', '</u>', 'Underlined Text');
                                  } else if (e.key === 's' || e.key === 'S') {
                                    e.preventDefault();
                                    handleCommitEdit();
                                  }
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              className="w-full flex-1 p-4 border border-blue-300 rounded-lg font-['Calibri',sans-serif] text-slate-800 text-[14.6px] leading-relaxed outline-hidden focus:ring-2 focus:ring-blue-500 resize-none min-h-[600px] bg-white selection:bg-blue-100 shadow-inner"
                              spellCheck={false}
                            />
                          </div>
                        ) : (
                          <RenderDocumentPageStructure
                            content={page.content}
                            pageBaseOffset={page.startOffset}
                            issues={pageIssues}
                            selectedIssueId={selectedIssueId}
                            fontFamily={fontFamily}
                            fontSize={fontSize}
                            onSelectIssue={(issue, rect) => {
                              onSelectIssue(issue.id);
                              setActivePopoverIssue(issue);
                              setTargetRect(rect);
                            }}
                            onPhotoClick={(photo) => setActivePhoto(photo)}
                          />
                        )}
                      </div>

                      {/* Running Footer inside Bottom Margin Zone */}
                      <div 
                        style={{ bottom: '24px', left: `${marginPadding.left}px`, right: `${marginPadding.right}px` }}
                        onClick={() => {
                          if (onOpenHeaderFooterModal) onOpenHeaderFooterModal();
                        }}
                        className="absolute flex items-center justify-between text-[11px] text-[#64748b] select-none border-t border-[#cbd5e1] pt-1.5 cursor-pointer hover:bg-blue-50/60 transition rounded px-1 group/ftr"
                        title="Click to edit Running Footer"
                      >
                        <div className="truncate max-w-[70%]">
                          <span className="font-medium text-slate-600 truncate">{effectiveFooter}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onOpenHeaderFooterModal && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenHeaderFooterModal();
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold transition flex items-center gap-1 bg-white/80 px-1.5 py-0.5 rounded border border-blue-200"
                              title="Edit Running Footer"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>Edit Footer</span>
                            </button>
                          )}
                          <span className="font-mono font-bold text-[#1f3864]">
                            Page {page.pageNumber} of {pages.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Page Break Visualiser Between Sheets */}
                    {showBreakGuides && pageIdx < pages.length - 1 && (
                      <div 
                        style={{ width: paperDimensions.width }}
                        className="py-2 px-4 rounded-lg bg-white/80 border border-[#d2d0ce] shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 select-none"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-blue-100 text-[#185abd] flex items-center justify-center">
                            <Scissors className="w-3 h-3" />
                          </div>
                          <span className="font-bold text-slate-800">
                            Page Break — End of Page {page.pageNumber}
                          </span>
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                            page.breakType === 'explicit'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : page.breakType === 'heading'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {page.breakType === 'explicit' ? 'Explicit Break (---)' : page.breakType === 'heading' ? 'Section Heading Break' : `${paperSize.toUpperCase()} Capacity (~${linesPerPage} lines)`}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>{page.lineCount} lines • {page.wordCount} words</span>
                          <button
                            onClick={() => {
                              const insertOffset = page.endOffset;
                              const newContent = content.slice(0, insertOffset) + '\n\n---\n<!-- Page Break -->\n\n' + content.slice(insertOffset);
                              onChange(newContent);
                              showStatusNotice('Inserted explicit manual break');
                            }}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold flex items-center gap-1 transition text-[10px]"
                          >
                            <Plus className="w-3 h-3 text-blue-600" />
                            <span>Insert Break</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. FLOATING FIX BOX ON TAPPED ISSUE                                       */}
      {/* ========================================================================= */}
      {activePopoverIssue && (
        <FloatingFixBox
          issue={activePopoverIssue}
          targetRect={targetRect}
          onApplyFix={handleApplyFixInternal}
          onApplyManualFix={handleApplyManualFixInternal}
          onIgnoreIssue={(id) => {
            if (onIgnoreIssue) onIgnoreIssue(id);
            setActivePopoverIssue(null);
            setTargetRect(null);
            onSelectIssue(null);
          }}
          onClose={() => {
            setActivePopoverIssue(null);
            setTargetRect(null);
            onSelectIssue(null);
          }}
          onJumpToEditor={onJumpToEditor ? () => onJumpToEditor(activePopoverIssue) : undefined}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. DOCUMENT PHOTO VIEWER MODAL                                            */}
      {/* ========================================================================= */}
      {activePhoto && (
        <DocumentPhotoViewer
          isOpen={!!activePhoto}
          src={activePhoto.src}
          alt={activePhoto.alt}
          caption={activePhoto.caption}
          onClose={() => setActivePhoto(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. AUTHENTIC MICROSOFT WORD BOTTOM STATUS BAR                             */}
      {/* ========================================================================= */}
      <div className="bg-[#f3f2f1] border-t border-[#d2d0ce] px-4 py-1.5 flex items-center justify-between gap-4 text-[11px] text-[#323130] select-none shrink-0 z-20">
        {/* Left: Page Navigator, Word Count, Language & Accessibility */}
        <div className="flex items-center gap-4">
          {/* Page Navigator */}
          <div className="flex items-center gap-1 bg-white border border-[#d2d0ce] rounded px-1.5 py-0.5">
            <button
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`p-0.5 rounded ${currentPage <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'}`}
              title="Previous Page"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="font-semibold text-slate-800 px-1">
              Page {currentPage} of {pages.length}
            </span>
            <button
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= pages.length}
              className={`p-0.5 rounded ${currentPage >= pages.length ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'}`}
              title="Next Page"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Word Count */}
          <div className="flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
               title="Document Word Count">
            <FileText className="w-3 h-3 text-slate-400" />
            <span><strong>{stats.wordCount.toLocaleString()}</strong> words</span>
          </div>

          {/* Language Indicator */}
          <span className="hidden sm:inline text-slate-500 font-medium">
            English (United States)
          </span>

          {/* Accessibility Indicator */}
          <div className="hidden md:flex items-center gap-1 text-slate-600" title="Accessibility check: verified">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Accessibility: Good to go</span>
          </div>

          {/* QA Verification Status */}
          <div className="hidden lg:flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${issues.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <span className="font-semibold text-slate-700">
              {issues.length > 0 ? `${issues.length} QA Alerts` : 'QA Verified'}
            </span>
          </div>
        </div>

        {/* Right: View Mode Switcher & Zoom Slider */}
        <div className="flex items-center gap-3">
          {/* View Buttons (Read Mode, Print Layout, Web Layout) */}
          <div className="flex items-center bg-white border border-[#d2d0ce] rounded p-0.5">
            <button
              onClick={() => setViewMode('read-mode')}
              className={`p-1 rounded transition ${viewMode === 'read-mode' ? 'bg-[#185abd] text-white' : 'text-slate-600 hover:text-slate-900'}`}
              title="Read Mode"
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('print-layout')}
              className={`p-1 rounded transition ${viewMode === 'print-layout' ? 'bg-[#185abd] text-white' : 'text-slate-600 hover:text-slate-900'}`}
              title="Print Layout (Standard MS Word Pages)"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('web-layout')}
              className={`p-1 rounded transition ${viewMode === 'web-layout' ? 'bg-[#185abd] text-white' : 'text-slate-600 hover:text-slate-900'}`}
              title="Web Layout"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Zoom Slider */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoomLevel(prev => Math.max(60, prev - 10))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded"
              title="Zoom Out (-10%)"
            >
              <Minus className="w-3 h-3" />
            </button>

            <input
              type="range"
              min={60}
              max={140}
              step={5}
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-16 sm:w-24 accent-[#185abd] h-1.5 bg-[#d2d0ce] rounded cursor-pointer"
              title={`Zoom: ${zoomLevel}%`}
            />

            <button
              onClick={() => setZoomLevel(prev => Math.min(140, prev + 10))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded"
              title="Zoom In (+10%)"
            >
              <Plus className="w-3 h-3" />
            </button>

            {/* Clickable 100% Reset Pill */}
            <button
              onClick={() => setZoomLevel(100)}
              className="font-mono font-bold text-slate-700 bg-white border border-[#d2d0ce] hover:border-[#185abd] hover:text-[#185abd] px-1.5 py-0.5 rounded text-[10px] min-w-[42px] text-center transition"
              title="Reset Zoom to 100%"
            >
              {zoomLevel}%
            </button>

            {/* Fit to Window Width */}
            <button
              onClick={handleFitToWidth}
              className="font-semibold text-slate-700 bg-white border border-[#d2d0ce] hover:border-[#185abd] hover:text-[#185abd] px-2 py-0.5 rounded text-[10px] text-center transition flex items-center gap-1 shadow-2xs"
              title="Fit Document to Window Width (Ctrl+Shift+F)"
            >
              <Maximize2 className="w-2.5 h-2.5 text-[#185abd]" />
              <span>Fit</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: Renders Authentic Microsoft Word Document Page Content
// =============================================================================
function RenderDocumentPageStructure({
  content,
  pageBaseOffset = 0,
  issues,
  selectedIssueId,
  fontFamily = 'Calibri',
  fontSize = 11,
  onSelectIssue,
  onPhotoClick,
}: {
  content: string;
  pageBaseOffset?: number;
  issues: QAIssue[];
  selectedIssueId: string | null;
  fontFamily?: string;
  fontSize?: number;
  onSelectIssue: (issue: QAIssue, rect: { top: number; bottom: number; left: number; right: number; width: number; height: number }) => void;
  onPhotoClick: (photo: { src: string; alt: string; caption?: string }) => void;
}) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  let lineOffsetTracker = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const currentLineStart = pageBaseOffset + lineOffsetTracker;

    // 1. Embedded Document Photo: ![alt](src)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1] || 'Document Photographic Plate';
      const src = imgMatch[2];

      elements.push(
        <div 
          key={`img-plate-${i}`} 
          className="my-5 p-3 bg-[#f8f9fa] border border-[#d2d0ce] rounded shadow-xs text-center group cursor-pointer hover:border-[#185abd] hover:shadow-md transition-all"
          onClick={() => onPhotoClick({ src, alt, caption: 'Extracted from Document' })}
        >
          <div className="relative inline-block max-w-full">
            <img 
              src={src} 
              alt={alt}
              className="max-h-[340px] max-w-full object-contain rounded border border-slate-300 bg-white mx-auto shadow-xs"
              loading="lazy"
            />
            <div className="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition shadow-sm flex items-center gap-1 text-[10px]">
              <Maximize2 className="w-3 h-3" />
              <span>Inspect</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium italic">
            <ImageIcon className="w-3.5 h-3.5 text-[#185abd]" />
            <span>{alt}</span>
          </div>
        </div>
      );

      lineOffsetTracker += rawLine.length + 1;
      i++;
      continue;
    }

    // 2. Page Break Divider (---)
    if (line === '---' || line === '***' || line === '___') {
      elements.push(
        <div key={`hr-${i}`} className="my-5 flex items-center justify-center gap-3 select-none text-slate-400">
          <div className="h-px bg-slate-300 flex-1" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Page Break</span>
          <div className="h-px bg-slate-300 flex-1" />
        </div>
      );
      lineOffsetTracker += rawLine.length + 1;
      i++;
      continue;
    }

    // 3. Authentic Microsoft Word Table Grid: | col | col |
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
      const tableRows: string[] = [];
      const tableStartOffset = currentLineStart;

      while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
        tableRows.push(lines[i]);
        lineOffsetTracker += lines[i].length + 1;
        i++;
      }

      elements.push(
        <div key={`table-${tableStartOffset}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse border border-[#b4b2af] text-[13px]">
            <thead>
              <tr className="bg-[#f1f5f9] text-[#0f172a] border-b-2 border-[#185abd]">
                {tableRows[0].replace(/^\|/, '').replace(/\|$/, '').split('|').map((col, cIdx) => (
                  <th key={`th-${cIdx}`} className="border border-[#cbd5e1] p-2 text-left font-bold text-xs uppercase tracking-wider text-slate-800">
                    <WordFormattedInline text={col.trim()} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(2).map((row, rIdx) => {
                const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
                return (
                  <tr key={`tr-${rIdx}`} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#fcfdfd]'}>
                    {cells.map((cell, cIdx) => {
                      const isNumeric = /^[$€£¥₹]?\s*-?\d+(?:,\d{2,3})*(?:\.\d+)?%?$/.test(cell);
                      return (
                        <td 
                          key={`td-${cIdx}`} 
                          className={`border border-[#cbd5e1] p-2 text-slate-800 ${isNumeric ? 'text-right font-mono font-medium' : 'text-left'}`}
                        >
                          <WordFormattedInline text={cell} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. Blockquote / Callout Box
    if (line.startsWith('> ')) {
      elements.push(
        <div key={`quote-${i}`} className="my-3 pl-4 py-2 border-l-4 border-[#185abd] bg-blue-50/60 rounded-r text-slate-700 italic text-[14px]">
          <RenderTextWithWordTags
            text={line.slice(2)}
            lineStartOffset={currentLineStart + 2}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </div>
      );
      lineOffsetTracker += rawLine.length + 1;
      i++;
      continue;
    }

    // 5. Microsoft Word Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 
          key={`h1-${i}`} 
          className="font-bold text-[#1f3864] border-b border-[#cbd5e1] pb-1.5 mt-5 mb-3 tracking-tight"
          style={{ fontSize: '18pt', fontFamily }}
        >
          <RenderTextWithWordTags
            text={line.slice(2)}
            lineStartOffset={currentLineStart + 2}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 
          key={`h2-${i}`} 
          className="font-bold text-[#2f5496] border-b border-[#e2e8f0] pb-1 mt-4 mb-2 tracking-tight"
          style={{ fontSize: '13.5pt', fontFamily }}
        >
          <RenderTextWithWordTags
            text={line.slice(3)}
            lineStartOffset={currentLineStart + 3}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 
          key={`h3-${i}`} 
          className="font-bold text-[#1f3864] mt-3 mb-1.5"
          style={{ fontSize: '12pt', fontFamily }}
        >
          <RenderTextWithWordTags
            text={line.slice(4)}
            lineStartOffset={currentLineStart + 4}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </h3>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Unordered List item
      elements.push(
        <li 
          key={`li-${i}`} 
          className="ml-6 list-disc text-slate-800 my-1 leading-[1.35]"
          style={{ fontSize: `${fontSize}pt` }}
        >
          <RenderTextWithWordTags
            text={line.slice(2)}
            lineStartOffset={currentLineStart + 2}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </li>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      // Ordered List item
      const match = line.match(/^(\d+\.\s+)(.*)$/);
      elements.push(
        <li 
          key={`oli-${i}`} 
          className="ml-6 list-decimal text-slate-800 my-1 leading-[1.35]"
          style={{ fontSize: `${fontSize}pt` }}
        >
          <RenderTextWithWordTags
            text={match ? match[2] : line}
            lineStartOffset={currentLineStart + (match ? match[1].length : 0)}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </li>
      );
    } else if (line.length === 0) {
      // Word paragraph space
      elements.push(<div key={`blank-${i}`} className="h-2.5" />);
    } else {
      // Standard Word Paragraph
      elements.push(
        <p 
          key={`p-${i}`} 
          className="text-slate-800 my-1.5 leading-[1.35]"
          style={{ fontSize: `${fontSize}pt` }}
        >
          <RenderTextWithWordTags
            text={rawLine}
            lineStartOffset={currentLineStart}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </p>
      );
    }

    lineOffsetTracker += rawLine.length + 1;
    i++;
  }

  return <div>{elements}</div>;
}

// =============================================================================
// SUB-COMPONENT: Highlights QA Issues on Word Text with Click-to-Fix
// =============================================================================
function RenderTextWithWordTags({
  text,
  lineStartOffset,
  issues,
  selectedIssueId,
  onSelectIssue,
}: {
  text: string;
  lineStartOffset: number;
  issues: QAIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (issue: QAIssue, rect: { top: number; bottom: number; left: number; right: number; width: number; height: number }) => void;
}) {
  const lineEndOffset = lineStartOffset + text.length;

  // Filter issues intersecting with this line's span
  const lineIssues = issues.filter(
    issue => issue.startOffset < lineEndOffset && issue.endOffset > lineStartOffset
  );

  if (lineIssues.length === 0) {
    return <WordFormattedInline text={text} />;
  }

  const segments: React.ReactNode[] = [];
  let currentPos = 0;

  const sortedIssues = [...lineIssues].sort((a, b) => a.startOffset - b.startOffset);

  for (const issue of sortedIssues) {
    const relStart = Math.max(0, issue.startOffset - lineStartOffset);
    const relEnd = Math.min(text.length, issue.endOffset - lineStartOffset);

    if (relStart < currentPos) continue;

    if (relStart > currentPos) {
      segments.push(
        <WordFormattedInline 
          key={`plain-${currentPos}`} 
          text={text.slice(currentPos, relStart)} 
        />
      );
    }

    const isSelected = issue.id === selectedIssueId;
    const isCritical = issue.severity === 'critical';
    const isWarning = issue.severity === 'warning';

    // Interactive Word QA Highlight Mark
    segments.push(
      <span
        key={`issue-tag-${issue.id}`}
        id={`page-issue-tag-${issue.id}`}
        onClick={(e) => {
          e.stopPropagation();
          const domRect = e.currentTarget.getBoundingClientRect();
          onSelectIssue(issue, {
            top: domRect.top,
            bottom: domRect.bottom,
            left: domRect.left,
            right: domRect.right,
            width: domRect.width,
            height: domRect.height,
          });
        }}
        className={`cursor-pointer inline-flex items-center gap-1 mx-0.5 px-1 py-0.2 rounded transition shadow-2xs ${
          isCritical
            ? 'bg-rose-100 text-rose-900 border-b-2 border-rose-500 hover:bg-rose-200'
            : isWarning
            ? 'bg-amber-100 text-amber-950 border-b-2 border-amber-500 hover:bg-amber-200'
            : 'bg-blue-100 text-blue-950 border-b-2 border-blue-500 hover:bg-blue-200'
        } ${isSelected ? 'ring-2 ring-blue-600 ring-offset-1 font-semibold' : ''}`}
        title={`${issue.title}: ${issue.description} (Click to apply fix)`}
      >
        <span>{text.slice(relStart, relEnd)}</span>
        <span className={`text-[8.5px] px-1 py-0.2 rounded font-bold uppercase ${
          isCritical ? 'bg-rose-600 text-white' : isWarning ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          Fix
        </span>
      </span>
    );

    currentPos = relEnd;
  }

  if (currentPos < text.length) {
    segments.push(
      <WordFormattedInline 
        key={`plain-end`} 
        text={text.slice(currentPos)} 
      />
    );
  }

  return <span>{segments}</span>;
}

// Inline renderer supporting markdown bold (**text**), italic (*text*), underline (<u>text</u> or __text__), strikethrough (~~text~~), highlight (<mark>text</mark>), code (`text`), sub, and sup
const WordFormattedInline: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  // Tokenize all supported inline formats
  const regex = /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|__[\s\S]+?__|<u>[\s\S]+?<\/u>|~~[\s\S]+?~~|<del>[\s\S]+?<\/del>|<s>[\s\S]+?<\/s>|<mark>[\s\S]+?<\/mark>|==[\s\S]+?==|`[^`]+?`|<code>[\s\S]+?<\/code>|<sub>[\s\S]+?<\/sub>|<sup>[\s\S]+?<\/sup>|\*[^*]+?\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = match.index;

    // 1. Bold & Italic (***text***)
    if (token.startsWith('***') && token.endsWith('***') && token.length >= 6) {
      parts.push(<strong key={key} className="font-bold text-[#0f172a]"><em className="italic">{token.slice(3, -3)}</em></strong>);
    }
    // 2. Bold (**text**)
    else if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      parts.push(<strong key={key} className="font-bold text-[#0f172a]">{token.slice(2, -2)}</strong>);
    }
    // 3. Underline (<u>text</u> or __text__)
    else if ((token.startsWith('<u>') && token.endsWith('</u>') && token.length >= 7) ||
             (token.startsWith('__') && token.endsWith('__') && token.length >= 4)) {
      const inner = token.startsWith('<u>') ? token.slice(3, -4) : token.slice(2, -2);
      parts.push(<u key={key} className="underline decoration-slate-700 decoration-1 underline-offset-2">{inner}</u>);
    }
    // 4. Strikethrough (~~text~~ or <del>text</del> or <s>text</s>)
    else if ((token.startsWith('~~') && token.endsWith('~~') && token.length >= 4) ||
             (token.startsWith('<del>') && token.endsWith('</del>') && token.length >= 11) ||
             (token.startsWith('<s>') && token.endsWith('</s>') && token.length >= 7)) {
      const inner = token.startsWith('~~') ? token.slice(2, -2) : token.startsWith('<del>') ? token.slice(5, -6) : token.slice(3, -4);
      parts.push(<del key={key} className="line-through text-slate-500">{inner}</del>);
    }
    // 5. Highlight (<mark>text</mark> or ==text==)
    else if ((token.startsWith('<mark>') && token.endsWith('</mark>') && token.length >= 13) ||
             (token.startsWith('==') && token.endsWith('==') && token.length >= 4)) {
      const inner = token.startsWith('<mark>') ? token.slice(6, -7) : token.slice(2, -2);
      parts.push(<mark key={key} className="bg-amber-200/90 text-amber-950 px-1 py-0.5 rounded-2xs font-medium">{inner}</mark>);
    }
    // 6. Inline Code (`code` or <code>code</code>)
    else if ((token.startsWith('`') && token.endsWith('`') && token.length >= 2) ||
             (token.startsWith('<code>') && token.endsWith('</code>') && token.length >= 13)) {
      const inner = token.startsWith('`') ? token.slice(1, -1) : token.slice(6, -7);
      parts.push(<code key={key} className="font-mono text-[12.5px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">{inner}</code>);
    }
    // 7. Subscript (<sub>text</sub>)
    else if (token.startsWith('<sub>') && token.endsWith('</sub>') && token.length >= 11) {
      parts.push(<sub key={key} className="text-[10px] text-slate-700">{token.slice(5, -6)}</sub>);
    }
    // 8. Superscript (<sup>text</sup>)
    else if (token.startsWith('<sup>') && token.endsWith('</sup>') && token.length >= 11) {
      parts.push(<sup key={key} className="text-[10px] text-slate-700">{token.slice(5, -6)}</sup>);
    }
    // 9. Italic (*text*)
    else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      parts.push(<em key={key} className="italic text-slate-700">{token.slice(1, -1)}</em>);
    } else {
      parts.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span>{parts.length > 0 ? parts : text}</span>;
}
