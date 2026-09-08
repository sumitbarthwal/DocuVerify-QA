import React, { useEffect, useRef, useState } from 'react';
import { QAIssue } from '../types';
import { renderDocxInContainer } from '../services/docxEngineService';
import { FileText, Loader2, AlertCircle } from 'lucide-react';

interface WordDocumentViewerProps {
  docxBuffer: ArrayBuffer | null;
  issues: QAIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (issue: QAIssue, rect: { top: number; bottom: number; left: number; right: number; width: number; height: number }) => void;
  zoomLevel: number;
  onPageChange?: (current: number, total: number) => void;
}

export function WordDocumentViewer({
  docxBuffer,
  issues,
  selectedIssueId,
  onSelectIssue,
  zoomLevel,
  onPageChange,
}: WordDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Render docx into DOM whenever docxBuffer changes
  useEffect(() => {
    if (!docxBuffer || !containerRef.current) return;

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
   * Scans text nodes inside the rendered Word document sections
   * and wraps matching text in interactive highlight marks.
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

    // Build a map of target texts to issues
    const activeIssues = issues.filter(i => !i.ignored);
    if (activeIssues.length === 0) return;

    // Find all paragraph and span text elements inside section.docx
    const articles = root.querySelectorAll('section.docx article, section.docx');
    articles.forEach((article) => {
      const walker = document.createTreeWalker(
        article,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Ignore text inside headers, footers, or comments
            if (node.parentElement?.closest('header, footer, .docx-comment')) {
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
              break; // Matched this node
            } catch (err) {
              console.warn('Could not highlight word mark:', err);
            }
          }
        }
      }
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center overflow-auto bg-slate-200/90 select-text">
      {/* Loading Overlay */}
      {isRendering && (
        <div className="absolute inset-0 z-30 bg-slate-100/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-700">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-sm font-semibold">Rendering Microsoft Word Page Layout...</span>
          <span className="text-xs text-slate-500">Calculating original page geometry, headers, footers, and embedded media</span>
        </div>
      )}

      {/* Error Fallback */}
      {renderError && (
        <div className="m-8 p-6 bg-white border border-rose-200 rounded-xl shadow-sm text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h4 className="font-bold text-slate-800 mb-1">Preview Notice</h4>
          <p className="text-xs text-slate-600 mb-4">{renderError}</p>
        </div>
      )}

      {/* Zoomable Word Canvas */}
      <div 
        className="w-full flex flex-col items-center py-8 transition-transform duration-150 origin-top"
        style={{
          transform: `scale(${zoomLevel / 100})`,
          transformOrigin: 'top center',
        }}
      >
        <div 
          ref={containerRef} 
          className="word-docx-preview-root w-full flex flex-col items-center"
        />
      </div>

      {/* Custom Styles to make docx-preview look like authentic Microsoft Word */}
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
          border: 1px solid #e2e8f0 !important;
          position: relative !important;
          color: #1e293b !important;
          font-family: 'Calibri', 'Segoe UI', Arial, sans-serif !important;
          line-height: 1.4 !important;
        }

        /* Running Header */
        .word-docx-preview-root section.docx > header {
          border-bottom: 1px solid #cbd5e1 !important;
          padding-bottom: 6px !important;
          margin-bottom: 16px !important;
          font-size: 8.5pt !important;
          color: #64748b !important;
        }

        /* Running Footer */
        .word-docx-preview-root section.docx > footer {
          border-top: 1px solid #cbd5e1 !important;
          padding-top: 6px !important;
          margin-top: 16px !important;
          font-size: 8.5pt !important;
          color: #64748b !important;
        }

        /* Tables */
        .word-docx-preview-root section.docx table {
          border-collapse: collapse !important;
          margin: 10pt 0 !important;
        }
        .word-docx-preview-root section.docx table td,
        .word-docx-preview-root section.docx table th {
          border: 1px solid #cbd5e1 !important;
          padding: 4pt 6pt !important;
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
