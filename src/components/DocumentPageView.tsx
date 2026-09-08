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
  SplitSquareHorizontal
} from 'lucide-react';
import { FloatingFixBox } from './FloatingFixBox';
import { DocumentPhotoViewer } from './DocumentPhotoViewer';
import { WordDocumentViewer } from './WordDocumentViewer';
import { createStandardDocxPackage } from '../services/docxEngineService';

export type PageLayoutMode = 'word-native' | 'multi-page' | 'two-page-spread' | 'continuous';

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
 * Splits document content into discrete physical-style pages.
 * Recognizes explicit page breaks (---), PDF page boundaries, major headings,
 * and standard A4/Letter page sheet line capacities without splitting tables or code blocks.
 */
function splitContentIntoPages(fullContent: string): DocumentPageItem[] {
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

    // Explicit page break marker (e.g. from PDF pages or Word section breaks)
    const isExplicitBreak = trimmed === '---' || trimmed === '***' || trimmed === '___';
    
    // Major heading starting a new section (if page already has substantial content)
    const isMajorHeading = (trimmed.startsWith('# ') || trimmed.startsWith('## ')) && currentPageLines.length >= 20;

    // A4/Letter standard page sheet capacity overflow (~48 lines) avoiding breaking tables/code blocks
    const isPageOverflow = currentPageLines.length >= 48 && !inTable && !inCodeBlock && trimmed.length === 0;

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
        isOverflow: linesCount > 48
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
      isOverflow: linesCount > 48
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
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [layoutMode, setLayoutMode] = useState<PageLayoutMode>(() => docxBuffer ? 'word-native' : 'multi-page');
  const [activeDocxBuffer, setActiveDocxBuffer] = useState<ArrayBuffer | null>(docxBuffer || null);
  const [wordPageTotal, setWordPageTotal] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [showPageBreakVisualiser, setShowPageBreakVisualiser] = useState<boolean>(true);
  const [spreadIndex, setSpreadIndex] = useState<number>(0);
  const [activePopoverIssue, setActivePopoverIssue] = useState<QAIssue | null>(null);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);
  const [editedText, setEditedText] = useState<string>(content);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Photo viewer state
  const [activePhoto, setActivePhoto] = useState<{ src: string; alt: string; caption?: string } | null>(null);

  // Keep local edited text in sync when content changes externally
  useEffect(() => {
    setEditedText(content);
  }, [content]);

  // Keep active docx buffer in sync when docxBuffer prop updates
  useEffect(() => {
    if (docxBuffer) {
      setActiveDocxBuffer(docxBuffer);
      setLayoutMode('word-native');
    }
  }, [docxBuffer]);

  // Split document into discrete pages
  const pages = useMemo(() => splitContentIntoPages(content), [content]);

  // Compute 2-page book spread pairs
  const spreadPairs = useMemo(() => {
    const pairs: Array<[DocumentPageItem, DocumentPageItem | null]> = [];
    for (let i = 0; i < pages.length; i += 2) {
      pairs.push([pages[i], pages[i + 1] || null]);
    }
    return pairs;
  }, [pages]);

  // Helper to insert an explicit manual page break at the end of a page
  const handleInsertExplicitPageBreak = (page: DocumentPageItem) => {
    const insertOffset = page.endOffset;
    const newContent = content.slice(0, insertOffset) + '\n\n---\n<!-- Page Break -->\n\n' + content.slice(insertOffset);
    onChange(newContent);
  };

  // Metadata extraction for running headers and footers (fallback if not provided by file)
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

  // Auto-generate genuine DOCX buffer if in 'word-native' view and no buffer yet
  useEffect(() => {
    if (layoutMode === 'word-native' && !activeDocxBuffer && content) {
      let isCancelled = false;
      createStandardDocxPackage(content, {
        title: docTitle,
        headerText: effectiveHeader,
        footerText: effectiveFooter,
        images: images,
      }).then((buf) => {
        if (!isCancelled) {
          setActiveDocxBuffer(buf);
          if (onDocxBufferChange) {
            onDocxBufferChange(buf);
          }
        }
      }).catch((err) => {
        console.warn('Could not generate Word document preview:', err);
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [layoutMode, activeDocxBuffer, content, docTitle, effectiveHeader, effectiveFooter, images, onDocxBufferChange]);

  // Smoothly scroll to a specific page sheet
  const scrollToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(pageNum, pages.length));
    setCurrentPage(clamped);
    const el = document.getElementById(`doc-page-sheet-${clamped}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Auto-detect current page on scroll
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container || layoutMode === 'continuous') return;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      for (let p = 1; p <= pages.length; p++) {
        const pageEl = document.getElementById(`doc-page-sheet-${p}`);
        if (pageEl) {
          const rect = pageEl.getBoundingClientRect();
          if (rect.bottom > containerTop + 100) {
            setCurrentPage(p);
            break;
          }
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pages.length, layoutMode]);

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

  // Update rect on window scroll or resize with requestAnimationFrame
  useEffect(() => {
    let animFrame: number;
    const updateRect = () => {
      cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        if (activePopoverIssue) {
          const el = document.getElementById(`page-issue-tag-${activePopoverIssue.id}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            setTargetRect({
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            });
          }
        }
      });
    };

    const container = pageContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateRect, { passive: true });
    }
    window.addEventListener('resize', updateRect, { passive: true });

    return () => {
      cancelAnimationFrame(animFrame);
      if (container) {
        container.removeEventListener('scroll', updateRect);
      }
      window.removeEventListener('resize', updateRect);
    };
  }, [activePopoverIssue]);

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
  };

  const handleCancelEdit = () => {
    setEditedText(content);
    setEditMode(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-200/80 overflow-hidden select-text relative">
      {/* Document View Controls Bar */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs select-none z-10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Document Preview</span>
          </span>

          {/* Page indicator & Next/Prev page navigator */}
          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-slate-700">
            <button
              onClick={() => {
                if (layoutMode === 'word-native') {
                  const container = pageContainerRef.current;
                  if (container) {
                    const wordPages = container.querySelectorAll('section.docx');
                    const targetIdx = Math.max(0, currentPage - 2);
                    if (wordPages[targetIdx]) {
                      wordPages[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }
                } else {
                  scrollToPage(currentPage - 1);
                }
              }}
              disabled={currentPage <= 1}
              className={`p-0.5 rounded hover:bg-white transition ${currentPage <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700'}`}
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold px-1 text-slate-800">
              Page {currentPage} of {layoutMode === 'word-native' ? wordPageTotal : pages.length}
            </span>
            <button
              onClick={() => {
                if (layoutMode === 'word-native') {
                  const container = pageContainerRef.current;
                  if (container) {
                    const wordPages = container.querySelectorAll('section.docx');
                    const targetIdx = Math.min(wordPages.length - 1, currentPage);
                    if (wordPages[targetIdx]) {
                      wordPages[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }
                } else {
                  scrollToPage(currentPage + 1);
                }
              }}
              disabled={currentPage >= (layoutMode === 'word-native' ? wordPageTotal : pages.length)}
              className={`p-0.5 rounded hover:bg-white transition ${currentPage >= (layoutMode === 'word-native' ? wordPageTotal : pages.length) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700'}`}
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Jump to Page select dropdown */}
            {pages.length > 1 && layoutMode !== 'word-native' && (
              <select
                value={currentPage}
                onChange={(e) => scrollToPage(Number(e.target.value))}
                className="ml-1 text-[11px] bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-700 font-medium focus:outline-none"
                title="Jump directly to page"
              >
                {pages.map((p) => (
                  <option key={p.pageNumber} value={p.pageNumber}>
                    P.{p.pageNumber} ({p.title.slice(0, 18)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {issues.length > 0 ? (
            <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-semibold border border-rose-200 hidden md:inline-block">
              {issues.length} Interactive Markers
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 hidden md:inline-block">
              ✓ Clean
            </span>
          )}
        </div>

        {/* View Mode, Zoom & Page Tools */}
        <div className="flex items-center gap-2">
          {/* Multi-View Layout Mode Toggle: Word Native vs Multi-Page Sheets vs Two-Page Spread vs Continuous Web Flow */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-slate-600 border border-slate-200">
            <button
              onClick={() => setLayoutMode('word-native')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
                layoutMode === 'word-native' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
              title="Original Microsoft Word Document Layout (Headers, Footers, Images & Margins)"
            >
              <FileText className="w-3 h-3 text-blue-600" />
              <span>Word Layout</span>
            </button>
            <button
              onClick={() => setLayoutMode('multi-page')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
                layoutMode === 'multi-page' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Multi-Page Physical Sheet Layout"
            >
              <BookOpen className="w-3 h-3" />
              <span className="hidden sm:inline">Pages</span>
            </button>
            <button
              onClick={() => setLayoutMode('two-page-spread')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
                layoutMode === 'two-page-spread' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Two-Page Side-by-Side Book Spread Layout"
            >
              <Columns2 className="w-3 h-3 text-indigo-600" />
              <span className="hidden sm:inline">Spread</span>
            </button>
            <button
              onClick={() => setLayoutMode('continuous')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition ${
                layoutMode === 'continuous' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Continuous Flowing Web Layout"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Flow</span>
            </button>
          </div>

          {/* Page Break Visualiser Toggle Button */}
          <button
            onClick={() => setShowPageBreakVisualiser(prev => !prev)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition border ${
              showPageBreakVisualiser
                ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Toggle visual page break indicators and print capacity limits"
          >
            <Scissors className="w-3 h-3 text-blue-600" />
            <span className="hidden md:inline">Break Guides</span>
          </button>

          {onOpenHeaderFooterModal && (
            <button
              onClick={onOpenHeaderFooterModal}
              className="px-2.5 py-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-md font-medium transition flex items-center gap-1 text-xs"
              title="Configure original running header and footer"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden lg:inline">Header &amp; Footer</span>
            </button>
          )}

          {editMode ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCommitEdit}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold transition flex items-center gap-1 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-2 py-1 text-slate-600 hover:text-slate-800 rounded-md font-medium transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md font-semibold transition flex items-center gap-1.5 shadow-2xs"
              title="Edit document directly on page"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Edit on Page</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Zoom buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-slate-600 border border-slate-200">
            <button
              onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
              className="p-1 hover:bg-white rounded transition"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 font-semibold">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(130, prev + 10))}
              className="p-1 hover:bg-white rounded transition"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="p-1 hover:bg-white rounded transition border-l border-slate-200 text-[10px] font-bold text-slate-500"
              title="Reset Zoom to 100%"
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Desk Scroll Canvas */}
      <div 
        ref={pageContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center scroll-smooth"
        onClick={() => {
          if (activePopoverIssue) {
            setActivePopoverIssue(null);
            setTargetRect(null);
            onSelectIssue(null);
          }
        }}
      >
        <div 
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          className={`transition-transform duration-150 w-full pb-16 ${
            layoutMode === 'word-native' ? 'max-w-4xl' : 'max-w-[850px]'
          }`}
        >
          {editMode ? (
            /* Direct Editable Surface within page card */
            <div className="bg-white rounded-xs shadow-xl border border-slate-300 min-h-[1050px] p-8 sm:p-14 md:p-16 flex flex-col text-slate-800">
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-center justify-between">
                <span>Direct Page Edit Mode active. Make your revisions below.</span>
                <button
                  onClick={handleCommitEdit}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded font-semibold text-[11px]"
                >
                  Done Editing
                </button>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="flex-1 w-full p-4 border border-slate-300 rounded-md font-['Calibri',sans-serif] text-slate-800 text-[15px] leading-relaxed outline-hidden focus:ring-2 focus:ring-blue-500 resize-none min-h-[750px]"
              />
            </div>
          ) : layoutMode === 'word-native' ? (
            /* Original Microsoft Word Rendered Document Pages */
            <div className="w-full flex flex-col items-center">
              <WordDocumentViewer
                docxBuffer={activeDocxBuffer}
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
                  setWordPageTotal(total);
                }}
              />
            </div>
          ) : layoutMode === 'two-page-spread' ? (
            /* Two-Page Side-by-Side Spread Layout */
            <div className="space-y-6">
              {/* Spread Navigation Bar */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSpreadIndex(prev => Math.max(0, prev - 1))}
                    disabled={spreadIndex === 0}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 border transition ${
                      spreadIndex === 0 ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous Spread</span>
                  </button>
                  <span className="font-mono text-xs font-bold text-slate-700 px-2">
                    Spread {spreadIndex + 1} of {spreadPairs.length}
                  </span>
                  <button
                    onClick={() => setSpreadIndex(prev => Math.min(spreadPairs.length - 1, prev + 1))}
                    disabled={spreadIndex >= spreadPairs.length - 1}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 border transition ${
                      spreadIndex >= spreadPairs.length - 1 ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                    }`}
                  >
                    <span>Next Spread</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs text-slate-500 font-medium hidden sm:block">
                  Viewing Pages {spreadPairs[spreadIndex]?.[0]?.pageNumber} &amp; {spreadPairs[spreadIndex]?.[1]?.pageNumber || 'Blank'} of {pages.length}
                </div>
              </div>

              {/* Side-by-side spread pages */}
              {spreadPairs[spreadIndex] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 items-start relative">
                  {/* Left Page (Verso) */}
                  {(() => {
                    const leftPage = spreadPairs[spreadIndex][0];
                    const leftIssues = issues.filter(iss => iss.startOffset < leftPage.endOffset && iss.endOffset >= leftPage.startOffset);
                    return (
                      <div 
                        key={`spread-left-${leftPage.pageNumber}`}
                        id={`doc-page-sheet-${leftPage.pageNumber}`}
                        className="bg-white rounded-xs shadow-xl border border-slate-300 min-h-[900px] p-6 sm:p-10 flex flex-col relative text-slate-800 font-['Calibri',sans-serif]"
                      >
                        <div className="border-b border-slate-300 pb-2 mb-6 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700 truncate max-w-[70%]">{effectiveHeader}</span>
                          <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Page {leftPage.pageNumber}</span>
                        </div>
                        <div className="flex-1 text-sm">
                          <RenderDocumentPageStructure
                            content={leftPage.content}
                            pageBaseOffset={leftPage.startOffset}
                            issues={leftIssues}
                            selectedIssueId={selectedIssueId}
                            onSelectIssue={(issue, rect) => {
                              onSelectIssue(issue.id);
                              setActivePopoverIssue(issue);
                              setTargetRect(rect);
                            }}
                            onPhotoClick={(photo) => setActivePhoto(photo)}
                          />
                        </div>
                        <div className="border-t border-slate-300 pt-2.5 mt-8 flex items-center justify-between text-[11px] text-slate-500">
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
                        <div className="bg-slate-50/50 rounded-xs border-2 border-dashed border-slate-200 min-h-[900px] p-6 flex flex-col items-center justify-center text-slate-400">
                          <FileText className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                          <p className="text-sm font-medium">End of Document</p>
                          <p className="text-xs text-slate-400">No facing page</p>
                        </div>
                      );
                    }
                    const rightIssues = issues.filter(iss => iss.startOffset < rightPage.endOffset && iss.endOffset >= rightPage.startOffset);
                    return (
                      <div 
                        key={`spread-right-${rightPage.pageNumber}`}
                        id={`doc-page-sheet-${rightPage.pageNumber}`}
                        className="bg-white rounded-xs shadow-xl border border-slate-300 min-h-[900px] p-6 sm:p-10 flex flex-col relative text-slate-800 font-['Calibri',sans-serif]"
                      >
                        <div className="border-b border-slate-300 pb-2 mb-6 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700 truncate max-w-[70%]">{effectiveHeader}</span>
                          <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Page {rightPage.pageNumber}</span>
                        </div>
                        <div className="flex-1 text-sm">
                          <RenderDocumentPageStructure
                            content={rightPage.content}
                            pageBaseOffset={rightPage.startOffset}
                            issues={rightIssues}
                            selectedIssueId={selectedIssueId}
                            onSelectIssue={(issue, rect) => {
                              onSelectIssue(issue.id);
                              setActivePopoverIssue(issue);
                              setTargetRect(rect);
                            }}
                            onPhotoClick={(photo) => setActivePhoto(photo)}
                          />
                        </div>
                        <div className="border-t border-slate-300 pt-2.5 mt-8 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[70%]">{effectiveFooter}</span>
                          <span className="font-mono font-bold text-slate-700">P. {rightPage.pageNumber}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : layoutMode === 'continuous' ? (
            /* Continuous Single Flow Layout */
            <div className="bg-white rounded-xs shadow-xl border border-slate-300 min-h-[1050px] p-8 sm:p-14 md:p-16 flex flex-col relative text-slate-800 font-['Calibri',sans-serif]">
              {/* Running Header */}
              <div className="border-b border-slate-300 pb-2.5 mb-8 flex items-center justify-between text-[11px] text-slate-500 select-none">
                <span className="font-bold text-slate-700 tracking-tight truncate max-w-[70%]">{effectiveHeader}</span>
                <span className="text-slate-400 font-medium">Continuous View</span>
              </div>

              {/* Document Content */}
              <div className="flex-1">
                <RenderDocumentPageStructure
                  content={content}
                  pageBaseOffset={0}
                  issues={issues}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={(issue, rect) => {
                    onSelectIssue(issue.id);
                    setActivePopoverIssue(issue);
                    setTargetRect(rect);
                  }}
                  onPhotoClick={(photo) => setActivePhoto(photo)}
                />
              </div>

              {/* Running Footer */}
              <div className="border-t border-slate-300 pt-3 mt-12 flex items-center justify-between text-[11px] text-slate-500 select-none">
                <span className="font-medium text-slate-600 truncate max-w-[70%]">{effectiveFooter}</span>
                <span className="font-mono text-slate-500">Continuous Document</span>
              </div>
            </div>
          ) : (
            /* Multi-Page Sheets Layout (Physical Paper Pages) */
            <div className="space-y-10">
              {pages.map((page, pageIdx) => {
                // Filter only issues on this specific page for lightning-fast rendering
                const pageIssues = issues.filter(
                  iss => iss.startOffset < page.endOffset && iss.endOffset >= page.startOffset
                );

                return (
                  <React.Fragment key={`doc-page-fragment-${page.pageNumber}`}>
                    <div 
                      key={`doc-page-sheet-${page.pageNumber}`}
                      id={`doc-page-sheet-${page.pageNumber}`}
                      className="bg-white rounded-xs shadow-xl border border-slate-300 min-h-[1050px] p-8 sm:p-14 md:p-16 flex flex-col relative text-slate-800 font-['Calibri',sans-serif] transition-shadow hover:shadow-2xl"
                    >
                      {/* Running Header at Top of Each Page */}
                      <div className="border-b border-slate-300 pb-2.5 mb-8 flex items-center justify-between text-[11px] text-slate-500 select-none group">
                        <div className="flex items-center gap-2 truncate max-w-[75%]">
                          <span className="font-bold text-slate-700 tracking-tight truncate">{effectiveHeader}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onOpenHeaderFooterModal && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenHeaderFooterModal();
                              }}
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-800 underline transition"
                              title="Edit running header text"
                            >
                              Edit Header
                            </button>
                          )}
                          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Page {page.pageNumber}</span>
                          </div>
                        </div>
                      </div>

                      {/* Document Page Body Area */}
                      <div className="flex-1">
                        <RenderDocumentPageStructure
                          content={page.content}
                          pageBaseOffset={page.startOffset}
                          issues={pageIssues}
                          selectedIssueId={selectedIssueId}
                          onSelectIssue={(issue, rect) => {
                            onSelectIssue(issue.id);
                            setActivePopoverIssue(issue);
                            setTargetRect(rect);
                          }}
                          onPhotoClick={(photo) => setActivePhoto(photo)}
                        />
                      </div>

                      {/* Running Footer at Bottom of Each Page */}
                      <div className="border-t border-slate-300 pt-3 mt-12 flex items-center justify-between text-[11px] text-slate-500 select-none group">
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
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-800 underline transition"
                              title="Edit running footer text"
                            >
                              Edit Footer
                            </button>
                          )}
                          <div className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Page {page.pageNumber} of {pages.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Page Break Visualiser Banner between sheets */}
                    {showPageBreakVisualiser && pageIdx < pages.length - 1 && (
                      <div className="my-6 py-2.5 px-4 rounded-xl bg-slate-100/90 border border-slate-300/80 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
                            <Scissors className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-bold text-slate-800">
                            Page Break ── End of Page {page.pageNumber} / Start of Page {page.pageNumber + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            page.breakType === 'explicit'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : page.breakType === 'heading'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {page.breakType === 'explicit' ? 'Explicit Break (---)' : page.breakType === 'heading' ? 'Section Heading Break' : 'A4 Capacity Break (~48 lines)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>{page.lineCount} lines • {page.wordCount} words</span>
                          {page.isOverflow ? (
                            <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                              ⚠️ Page Overflow ({page.lineCount}/48 lines)
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                              ✓ Capacity OK ({page.lineCount}/48 lines)
                            </span>
                          )}
                          <button
                            onClick={() => handleInsertExplicitPageBreak(page)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold flex items-center gap-1 transition text-[10px]"
                            title="Insert an explicit manual page break (---) at this location"
                          >
                            <Plus className="w-3 h-3 text-blue-600" />
                            <span>Insert Manual Break</span>
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

      {/* Floating Fix Box positioned just above or below the tapped error */}
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
    </div>
  );
};

// Component: Renders structured document content (headings, tables, lists, text, and photos) with live visual tags
function RenderDocumentPageStructure({
  content,
  pageBaseOffset = 0,
  issues,
  selectedIssueId,
  onSelectIssue,
  onPhotoClick,
}: {
  content: string;
  pageBaseOffset?: number;
  issues: QAIssue[];
  selectedIssueId: string | null;
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

    // 1. Check for Embedded Document Photo: ![alt](src)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1] || 'Document Photographic Plate';
      const src = imgMatch[2];

      elements.push(
        <div 
          key={`img-plate-${i}`} 
          className="my-6 p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-xs text-center group cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
          onClick={() => onPhotoClick({ src, alt, caption: 'Extracted from Document' })}
        >
          <div className="relative inline-block max-w-full">
            <img 
              src={src} 
              alt={alt}
              className="max-h-[360px] max-w-full object-contain rounded-lg border border-slate-300 bg-white mx-auto shadow-xs"
              loading="lazy"
            />
            <div className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition shadow-sm flex items-center gap-1 text-[11px]">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Zoom &amp; Inspect</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium">
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{alt}</span>
          </div>
        </div>
      );

      lineOffsetTracker += rawLine.length + 1;
      i++;
      continue;
    }

    // 2. Check for Page Break divider
    if (line === '---' || line === '***' || line === '___') {
      elements.push(
        <div key={`hr-${i}`} className="my-6 flex items-center justify-center gap-3 select-none text-slate-400">
          <div className="h-px bg-slate-300 flex-1" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Section Break</span>
          <div className="h-px bg-slate-300 flex-1" />
        </div>
      );
      lineOffsetTracker += rawLine.length + 1;
      i++;
      continue;
    }

    // 3. Check if start of Markdown Table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
      const tableRows: string[] = [];
      const tableStartOffset = currentLineStart;

      while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
        tableRows.push(lines[i]);
        lineOffsetTracker += lines[i].length + 1;
        i++;
      }

      // Render table with visual tags inside cells
      elements.push(
        <div key={`table-${tableStartOffset}`} className="my-5 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-300">
                {tableRows[0].replace(/^\|/, '').replace(/\|$/, '').split('|').map((col, cIdx) => (
                  <th key={`th-${cIdx}`} className="border border-slate-300 p-2.5 text-left font-bold text-xs uppercase tracking-wider text-slate-700">
                    {col.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(2).map((row, rIdx) => {
                const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
                return (
                  <tr key={`tr-${rIdx}`} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                    {cells.map((cell, cIdx) => {
                      const isNumeric = /^[$€£¥]?\s*-?\d+(?:,\d{3})*(?:\.\d+)?%?$/.test(cell);
                      return (
                        <td 
                          key={`td-${cIdx}`} 
                          className={`border border-slate-300 p-2 text-slate-800 ${isNumeric ? 'text-right font-mono' : 'text-left'}`}
                        >
                          {cell}
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

    // 4. Blockquotes / Callout boxes
    if (line.startsWith('> ')) {
      elements.push(
        <div key={`quote-${i}`} className="my-3 pl-4 py-2 border-l-4 border-blue-500 bg-blue-50/50 rounded-r text-slate-700 italic text-[14px]">
          <RenderTextWithTags
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

    // 5. Render Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl sm:text-3xl font-bold text-blue-900 border-b-2 border-blue-600 pb-2 mt-6 mb-4">
          <RenderTextWithTags
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
        <h2 key={`h2-${i}`} className="text-lg sm:text-xl font-bold text-blue-800 border-b border-slate-200 pb-1.5 mt-6 mb-3">
          <RenderTextWithTags
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
        <h3 key={`h3-${i}`} className="text-base font-bold text-slate-800 mt-4 mb-2">
          <RenderTextWithTags
            text={line.slice(4)}
            lineStartOffset={currentLineStart + 4}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </h3>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={`li-${i}`} className="ml-5 list-disc text-slate-800 text-[15px] leading-relaxed my-1">
          <RenderTextWithTags
            text={line.slice(2)}
            lineStartOffset={currentLineStart + 2}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </li>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      const match = line.match(/^(\d+\.\s+)(.*)$/);
      elements.push(
        <li key={`oli-${i}`} className="ml-5 list-decimal text-slate-800 text-[15px] leading-relaxed my-1">
          <RenderTextWithTags
            text={match ? match[2] : line}
            lineStartOffset={currentLineStart + (match ? match[1].length : 0)}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </li>
      );
    } else if (line.length === 0) {
      elements.push(<div key={`blank-${i}`} className="h-3" />);
    } else {
      elements.push(
        <p key={`p-${i}`} className="text-slate-800 text-[15px] leading-relaxed my-2">
          <RenderTextWithTags
            text={rawLine}
            lineStartOffset={currentLineStart}
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={onSelectIssue}
          />
        </p>
      );
    }

    lineOffsetTracker += rawLine.length + 1; // +1 for newline
    i++;
  }

  return <div>{elements}</div>;
}

// Sub-component: Injects clickable visual QA highlight badges directly onto tokens matching issues
function RenderTextWithTags({
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

  // Find issues intersecting with this line's offset span
  const lineIssues = issues.filter(
    issue => issue.startOffset < lineEndOffset && issue.endOffset > lineStartOffset
  );

  if (lineIssues.length === 0) {
    return <span>{text}</span>;
  }

  // Segment the line's text
  const segments: React.ReactNode[] = [];
  let currentPos = 0;

  // Sort by start offset within line
  const sortedIssues = [...lineIssues].sort((a, b) => a.startOffset - b.startOffset);

  for (const issue of sortedIssues) {
    const relStart = Math.max(0, issue.startOffset - lineStartOffset);
    const relEnd = Math.min(text.length, issue.endOffset - lineStartOffset);

    if (relStart < currentPos) continue;

    // Plain text before issue
    if (relStart > currentPos) {
      segments.push(
        <span key={`plain-${currentPos}`}>
          {text.slice(currentPos, relStart)}
        </span>
      );
    }

    const isSelected = issue.id === selectedIssueId;
    const isCritical = issue.severity === 'critical';
    const isWarning = issue.severity === 'warning';

    // Highlighted tag with click listener that extracts DOM position
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
        className={`cursor-pointer inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded text-[13px] font-semibold transition shadow-2xs border ${
          isCritical 
            ? 'bg-rose-100 text-rose-900 border-rose-400 hover:bg-rose-200' 
            : isWarning 
            ? 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200'
            : 'bg-blue-100 text-blue-950 border-blue-400 hover:bg-blue-200'
        } ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-105' : ''}`}
        title={`${issue.title}: ${issue.description} (Tap to view and edit fix)`}
      >
        <span>{text.slice(relStart, relEnd)}</span>
        <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
          isCritical ? 'bg-rose-600 text-white' : isWarning ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          Fix
        </span>
      </span>
    );

    currentPos = relEnd;
  }

  // Trailing text
  if (currentPos < text.length) {
    segments.push(
      <span key={`plain-end`}>
        {text.slice(currentPos)}
      </span>
    );
  }

  return <span>{segments}</span>;
}
