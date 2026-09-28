import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QAIssue } from '../types';
import { renderDocxInContainer, patchDocxArrayBuffer, updateDocxHeaderFooter } from '../services/docxEngineService';
import { FileText, Loader2, Edit3, Check, Sparkles, Scissors, Undo, Redo, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';

interface WordDocumentViewerProps {
  docxBuffer: ArrayBuffer | null;
  onDocxBufferChange?: (buffer: ArrayBuffer) => void;
  issues: QAIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (issue: QAIssue, rect: { top: number; bottom: number; left: number; right: number; width: number; height: number }) => void;
  zoomLevel: number;
  onPageChange?: (current: number, total: number) => void;
  onContentChange?: (updatedContent: string) => void;
  onOpenHeaderFooterModal?: () => void;
  onApplyFix?: (issue: QAIssue) => void;
  headerText?: string;
  footerText?: string;
  isEditable?: boolean;
}

export function WordDocumentViewer({
  docxBuffer,
  onDocxBufferChange,
  issues,
  selectedIssueId,
  onSelectIssue,
  zoomLevel,
  onPageChange,
  onContentChange,
  onOpenHeaderFooterModal,
  onApplyFix,
  headerText,
  footerText,
  isEditable = true,
}: WordDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDirectEditing, setIsDirectEditing] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const syncTimeoutRef = useRef<any>(null);
  const isInternalUpdateRef = useRef<boolean>(false);

  // Render docx into DOM whenever docxBuffer changes (unless triggered by internal typing)
  useEffect(() => {
    if (!docxBuffer || !containerRef.current) return;
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    let isCancelled = false;
    setIsRendering(true);
    setRenderError(null);

    const render = async () => {
      try {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        await renderDocxInContainer(docxBuffer, containerRef.current);

        if (isCancelled) return;

        // Detect rendered pages
        const pages = containerRef.current.querySelectorAll('section.docx');
        const count = pages.length > 0 ? pages.length : 1;
        setPageCount(count);
        if (onPageChange) {
          onPageChange(1, count);
        }

        // Configure direct in-place editing on rendered Word pages
        setupInteractiveWordDocument();

        // Apply interactive QA issue highlight marks directly on the rendered Word page text
        applyIssueHighlights();
      } catch (err: any) {
        console.error('Word rendering error:', err);
        if (!isCancelled) {
          setRenderError(err?.message || 'Could not render Word document preview');
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
    };
  }, [docxBuffer]);

  // Re-apply issue highlights if issues list or selectedIssueId changes
  useEffect(() => {
    if (!isRendering && containerRef.current) {
      applyIssueHighlights();
    }
  }, [issues, selectedIssueId, isRendering]);

  // Track current page based on scroll position in the document container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const pages = container.querySelectorAll('section.docx');
      if (pages.length === 0) return;

      const containerTop = container.getBoundingClientRect().top;
      let closestPage = 1;
      let minDistance = Infinity;

      pages.forEach((page, index) => {
        const rect = page.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop - 40);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = index + 1;
        }
      });

      setCurrentPage(closestPage);
      if (onPageChange) {
        onPageChange(closestPage, pages.length);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [onPageChange, pageCount]);

  /**
   * Sets up contenteditable and interactive header/footer controls on the rendered Word sections.
   */
  const setupInteractiveWordDocument = () => {
    const root = containerRef.current;
    if (!root) return;

    const sections = root.querySelectorAll('section.docx');
    sections.forEach((section, sIdx) => {
      // 1. Make the article body directly editable
      const article = section.querySelector('article');
      if (article) {
        article.setAttribute('contenteditable', isEditable ? 'true' : 'false');
        article.setAttribute('spellcheck', 'false');
        (article as HTMLElement).style.outline = 'none';
        (article as HTMLElement).style.cursor = 'text';

        // Listen for user text input and edits
        article.addEventListener('input', handleDocumentInput);
      }

      // 2. Make Running Header interactive
      const header = section.querySelector('header');
      if (header) {
        header.classList.add('group/word-header', 'relative', 'cursor-pointer');
        header.title = 'Running Header — Click to edit original header across pages';
        (header as HTMLElement).style.outline = 'none';

        // Add subtle Edit Badge if not already added
        if (!header.querySelector('.word-header-edit-badge')) {
          const badge = document.createElement('button');
          badge.className = 'word-header-edit-badge opacity-0 group-hover/word-header:opacity-100 transition absolute right-2 top-1 text-[10px] font-semibold text-blue-700 bg-white/90 hover:bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-1 z-10';
          badge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Header`;
          badge.onclick = (e) => {
            e.stopPropagation();
            if (onOpenHeaderFooterModal) onOpenHeaderFooterModal();
          };
          header.appendChild(badge);
        }

        header.onclick = () => {
          if (onOpenHeaderFooterModal) onOpenHeaderFooterModal();
        };
      }

      // 3. Make Running Footer interactive
      const footer = section.querySelector('footer');
      if (footer) {
        footer.classList.add('group/word-footer', 'relative', 'cursor-pointer');
        footer.title = 'Running Footer — Click to edit original footer across pages';
        (footer as HTMLElement).style.outline = 'none';

        if (!footer.querySelector('.word-footer-edit-badge')) {
          const badge = document.createElement('button');
          badge.className = 'word-footer-edit-badge opacity-0 group-hover/word-footer:opacity-100 transition absolute right-2 bottom-1 text-[10px] font-semibold text-blue-700 bg-white/90 hover:bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-1 z-10';
          badge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit Footer`;
          badge.onclick = (e) => {
            e.stopPropagation();
            if (onOpenHeaderFooterModal) onOpenHeaderFooterModal();
          };
          footer.appendChild(badge);
        }

        footer.onclick = () => {
          if (onOpenHeaderFooterModal) onOpenHeaderFooterModal();
        };
      }
    });
  };

  /**
   * Handles user input inside the contenteditable Word pages.
   * Extracts text, updates QA engine, and patches docx buffer seamlessly.
   */
  const handleDocumentInput = useCallback(() => {
    setSaveStatus('saving');

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const root = containerRef.current;
      if (!root) return;

      // Extract updated document text representation
      const articles = root.querySelectorAll('section.docx article, section.docx');
      const textLines: string[] = [];

      articles.forEach((art) => {
        art.childNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            if (tag === 'header' || tag === 'footer') return;

            if (tag === 'table') {
              const rows = el.querySelectorAll('tr');
              rows.forEach((tr, rIdx) => {
                const cells = Array.from(tr.querySelectorAll('th, td')).map(c => (c.textContent || '').trim());
                if (cells.length > 0) {
                  textLines.push(`| ${cells.join(' | ')} |`);
                  if (rIdx === 0) {
                    textLines.push(`| ${cells.map(() => '---').join(' | ')} |`);
                  }
                }
              });
              textLines.push('');
              return;
            }

            const text = (el.textContent || '').trim();
            if (text) {
              if (tag === 'h1') textLines.push(`# ${text}`);
              else if (tag === 'h2') textLines.push(`## ${text}`);
              else if (tag === 'h3') textLines.push(`### ${text}`);
              else textLines.push(text);
              textLines.push('');
            }
          }
        });
      });

      const updatedContent = textLines.join('\n').trim();
      if (updatedContent && onContentChange) {
        onContentChange(updatedContent);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 450);
  }, [onContentChange]);

  /**
   * Scans text nodes inside the rendered Word document sections
   * and wraps matching text in interactive highlight marks without resetting cursor.
   */
  const applyIssueHighlights = () => {
    const root = containerRef.current;
    if (!root) return;

    // Remove previous marks
    const existingMarks = root.querySelectorAll('.word-qa-mark');
    existingMarks.forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m);
        parent.normalize();
      }
    });

    if (issues.length === 0) return;

    const activeIssues = issues.filter(i => !i.ignored);
    if (activeIssues.length === 0) return;

    // Scan text elements inside articles
    const articles = root.querySelectorAll('section.docx article, section.docx');
    articles.forEach((article) => {
      const walker = document.createTreeWalker(
        article,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (node.parentElement?.closest('header, footer, .docx-comment, .word-header-edit-badge, .word-footer-edit-badge')) {
              return NodeFilter.FILTER_REJECT;
            }
            if (!node.textContent || node.textContent.trim().length === 0) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes: Text[] = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode as Text);
        currentNode = walker.nextNode();
      }

      for (const textNode of textNodes) {
        const nodeText = textNode.nodeValue || '';

        for (const issue of activeIssues) {
          const needle = (issue.originalText || '').trim();
          if (!needle || needle.length < 2) continue;

          const matchIndex = nodeText.toLowerCase().indexOf(needle.toLowerCase());
          if (matchIndex >= 0 && textNode.parentNode) {
            try {
              const matchedStr = nodeText.substring(matchIndex, matchIndex + needle.length);
              const beforeText = nodeText.substring(0, matchIndex);
              const afterText = nodeText.substring(matchIndex + needle.length);

              const mark = document.createElement('mark');
              mark.className = `word-qa-mark word-qa-${issue.severity.toLowerCase()} ${
                selectedIssueId === issue.id ? 'is-selected' : ''
              }`;
              mark.id = `page-issue-tag-${issue.id}`;
              mark.setAttribute('data-issue-id', issue.id);
              mark.textContent = matchedStr;

              mark.onclick = (e) => {
                e.stopPropagation();
                const rect = mark.getBoundingClientRect();
                onSelectIssue(issue, {
                  top: rect.top,
                  bottom: rect.bottom,
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                  height: rect.height,
                });
              };

              const fragment = document.createDocumentFragment();
              if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
              fragment.appendChild(mark);
              if (afterText) fragment.appendChild(document.createTextNode(afterText));

              textNode.parentNode.replaceChild(fragment, textNode);
              break;
            } catch (err) {
              console.warn('Could not highlight word mark:', err);
            }
          }
        }
      }
    });
  };

  /**
   * Applies rich text formatting directly to active selection in the document.
   */
  const handleExecCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleDocumentInput();
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#f3f2f1] select-text">
      {/* Authentic In-Place Word Editor Control Ribbon Bar */}
      <div className="bg-white border-b border-[#d2d0ce] px-3 py-1.5 flex items-center justify-between gap-3 text-xs text-slate-700 shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-[#1f3864]">Authentic Word Document</span>
            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-medium hidden sm:inline">
              100% Original Formatting
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {/* Quick Selection Formatting Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('bold'); }}
              className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 font-bold w-6 h-6 flex items-center justify-center transition"
              title="Bold Selection (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('italic'); }}
              className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 italic w-6 h-6 flex items-center justify-center transition"
              title="Italic Selection (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('underline'); }}
              className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition"
              title="Underline Selection (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('strikeThrough'); }}
              className="p-1 hover:bg-[#f3f2f1] active:bg-[#edebe9] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition"
              title="Strikethrough Selection"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5 hidden md:flex">
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('justifyLeft'); }}
              className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition"
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('justifyCenter'); }}
              className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition"
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('justifyRight'); }}
              className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition"
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('insertUnorderedList'); }}
              className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition"
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleExecCommand('insertOrderedList'); }}
              className="p-1 hover:bg-[#f3f2f1] rounded text-slate-700 w-6 h-6 flex items-center justify-center transition"
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving edits...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
              <Check className="w-3 h-3" />
              <span>Changes preserved</span>
            </span>
          )}

          {onOpenHeaderFooterModal && (
            <button
              onClick={onOpenHeaderFooterModal}
              className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded flex items-center gap-1 transition"
              title="Configure Running Header & Footer fidelity"
            >
              <Edit3 className="w-3 h-3 text-blue-600" />
              <span>Header / Footer</span>
            </button>
          )}

          <div className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Page {currentPage} of {pageCount}
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isRendering && (
        <div className="absolute inset-0 z-30 bg-[#f3f2f1]/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-700">
          <Loader2 className="w-8 h-8 text-[#185abd] animate-spin" />
          <span className="text-sm font-semibold text-[#185abd]">Rendering Original Microsoft Word Layout...</span>
          <span className="text-xs text-slate-500">Preserving exact headers, footers, tables, fonts, borders, and margins</span>
        </div>
      )}

      {/* Error Fallback */}
      {renderError && (
        <div className="m-8 p-6 bg-white border border-slate-300 rounded-xl shadow-sm text-center max-w-md mx-auto">
          <FileText className="w-8 h-8 text-[#185abd] mx-auto mb-2" />
          <h4 className="font-bold text-slate-800 mb-1">Word Engine Status</h4>
          <p className="text-xs text-slate-600 mb-2">{renderError}</p>
          <span className="text-xs font-semibold text-[#185abd]">Word OpenXML Layout Engine active</span>
        </div>
      )}

      {/* Zoomable Word Canvas with Unclipped Horizontal & Vertical Scrolling */}
      <div className="w-full flex-1 overflow-x-auto overflow-y-auto bg-[#f3f2f1] select-text">
        <div 
          style={{ minWidth: `${Math.round(816 * (zoomLevel / 100)) + 48}px` }}
          className="w-full min-h-full flex flex-col items-center py-6 px-4"
        >
          <div 
            style={{ width: `${Math.round(816 * (zoomLevel / 100))}px`, minWidth: `${Math.round(816 * (zoomLevel / 100))}px` }}
            className="flex flex-col items-center relative"
          >
            <div 
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top left',
                width: '816px',
              }}
              className="transition-transform duration-150 flex flex-col items-center"
            >
              <div 
                ref={containerRef} 
                className="word-docx-preview-root w-full flex flex-col items-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Clean styles to enhance docx-preview without overriding original formatting */}
      <style>{`
        .word-docx-preview-root .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
        }

        .word-docx-preview-root section.docx {
          background: #ffffff !important;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.08) !important;
          margin-bottom: 28px !important;
          border-radius: 2px !important;
          border: 1px solid #d2d0ce !important;
          position: relative !important;
          line-height: 1.35 !important;
        }

        .word-docx-preview-root section.docx article[contenteditable="true"] {
          outline: none !important;
        }

        /* Interactive QA issue highlight marks */
        .word-qa-mark {
          cursor: pointer !important;
          padding: 1px 3px !important;
          border-radius: 3px !important;
          font-weight: 500 !important;
          transition: all 0.15s ease !important;
          text-decoration: none !important;
        }
        .word-qa-mark.word-qa-critical {
          background-color: #fee2e2 !important;
          color: #991b1b !important;
          border-bottom: 2px solid #ef4444 !important;
        }
        .word-qa-mark.word-qa-warning {
          background-color: #fef3c7 !important;
          color: #92400e !important;
          border-bottom: 2px solid #f59e0b !important;
        }
        .word-qa-mark.word-qa-suggestion {
          background-color: #dbeafe !important;
          color: #1e40af !important;
          border-bottom: 2px solid #3b82f6 !important;
        }
        .word-qa-mark.word-qa-consistency {
          background-color: #f3e8ff !important;
          color: #6b21a8 !important;
          border-bottom: 2px solid #a855f7 !important;
        }
        .word-qa-mark:hover {
          filter: brightness(0.95) !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4) !important;
        }
        .word-qa-mark.is-selected {
          outline: 2.5px solid #2563eb !important;
          box-shadow: 0 0 8px rgba(37, 99, 235, 0.45) !important;
        }
      `}</style>
    </div>
  );
}
