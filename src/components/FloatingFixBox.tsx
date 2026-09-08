import React, { useState, useEffect, useRef } from 'react';
import { QAIssue, AISuggestionOption } from '../types';
import { requestAISmartFix } from '../services/aiAuditService';
import { 
  Check, 
  X, 
  Edit3, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  EyeOff, 
  Sparkles, 
  Loader2, 
  ExternalLink 
} from 'lucide-react';

export interface FloatingFixBoxProps {
  issue: QAIssue;
  targetRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null;
  onApplyFix: (issue: QAIssue) => void;
  onApplyManualFix: (issue: QAIssue, replacement: string) => void;
  onIgnoreIssue?: (issueId: string) => void;
  onClose: () => void;
  onJumpToEditor?: (issue: QAIssue) => void;
}

export const FloatingFixBox: React.FC<FloatingFixBoxProps> = ({
  issue,
  targetRect,
  onApplyFix,
  onApplyManualFix,
  onIgnoreIssue,
  onClose,
  onJumpToEditor,
}) => {
  const [manualText, setManualText] = useState<string>(issue.suggestedText || issue.originalText);
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [showAISuggestions, setShowAISuggestions] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestionOption[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever the selected issue changes
  useEffect(() => {
    setManualText(issue.suggestedText || issue.originalText);
    setIsManualMode(false);
    setShowAISuggestions(false);
    setAiSuggestions([]);
    setAiError(null);
  }, [issue.id]);

  // Focus manual input when manual edit mode is activated
  useEffect(() => {
    if (isManualMode && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isManualMode]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Viewport calculation and safe clamping
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const popoverWidth = Math.min(460, windowWidth - 24);

  // Estimate height based on active mode
  let estimatedHeight = 270;
  if (isManualMode) estimatedHeight += 80;
  if (showAISuggestions) estimatedHeight += 140;

  let calculatedLeft = 16;
  let calculatedTop = 80;
  let placeAbove = false;
  let arrowLeft = popoverWidth / 2;

  if (targetRect) {
    const targetCenter = targetRect.left + targetRect.width / 2;
    calculatedLeft = targetCenter - popoverWidth / 2;
    // Horizontal clamping
    calculatedLeft = Math.max(12, Math.min(windowWidth - popoverWidth - 12, calculatedLeft));
    arrowLeft = Math.max(20, Math.min(popoverWidth - 20, targetCenter - calculatedLeft));

    const spaceAbove = targetRect.top;
    const spaceBelow = windowHeight - targetRect.bottom;

    if (spaceAbove >= estimatedHeight + 15 && spaceBelow < estimatedHeight + 15) {
      placeAbove = true;
      calculatedTop = Math.max(16, targetRect.top - estimatedHeight - 10);
    } else {
      placeAbove = false;
      calculatedTop = Math.min(windowHeight - estimatedHeight - 16, Math.max(16, targetRect.bottom + 10));
    }
  } else {
    // Center fallback when element is not directly in view or in table
    calculatedLeft = Math.max(12, (windowWidth - popoverWidth) / 2);
    calculatedTop = Math.max(24, (windowHeight - estimatedHeight) / 2);
  }

  const isCritical = issue.severity === 'critical';
  const isWarning = issue.severity === 'warning';

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (manualText !== undefined) {
      onApplyManualFix(issue, manualText);
    }
  };

  const handleFetchAISuggestions = async () => {
    setShowAISuggestions(true);
    if (aiSuggestions.length > 0) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await requestAISmartFix(
        issue.originalText,
        issue.contextSnippet,
        issue.description,
        issue.category
      );
      if (res.success && res.suggestions.length > 0) {
        setAiSuggestions(res.suggestions);
      } else {
        setAiError(res.error || 'No AI variations generated');
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to connect to AI service');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop overlay for reliable outside dismissal */}
      <div 
        className="fixed inset-0 z-[9990] bg-slate-900/20 backdrop-blur-[0.5px] cursor-default"
        onClick={onClose}
      />

      <div
        ref={popoverRef}
        id={`floating-fix-box-${issue.id}`}
        style={{
          position: 'fixed',
          left: `${calculatedLeft}px`,
          top: `${calculatedTop}px`,
          width: `${popoverWidth}px`,
          zIndex: 9999,
        }}
        className="bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 p-4 transition-all duration-150 animate-in fade-in zoom-in-95 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Directional Caret Pointer Arrow (Only shown if targetRect provided and in range) */}
        {targetRect && (
          <div
            style={{
              left: `${arrowLeft}px`,
              top: placeAbove ? '100%' : '0',
              transform: placeAbove ? 'translate(-50%, -1px)' : 'translate(-50%, -100%)',
            }}
            className="absolute pointer-events-none w-3 h-3 overflow-hidden"
          >
            <div
              className={`w-2.5 h-2.5 bg-slate-900 border border-slate-700 transform rotate-45 mx-auto ${
                placeAbove ? '-mt-1' : 'mt-1.5'
              }`}
            />
          </div>
        )}

        {/* Header with Severity, Category & Dismiss */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                isCritical
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : isWarning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}
            >
              {isCritical ? (
                <AlertCircle className="w-3 h-3" />
              ) : isWarning ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <Info className="w-3 h-3" />
              )}
              <span>{issue.severity}</span>
            </span>

            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
              {issue.category}
            </span>

            {issue.lineNumber > 0 && (
              <span className="text-[11px] text-slate-400">
                Line {issue.lineNumber}
              </span>
            )}

            {issue.isAiGenerated && (
              <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded text-[10px] font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                <span>AI</span>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
            title="Close fix box (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Description */}
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-white leading-snug">
            {issue.title}
          </h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {issue.description}
          </p>
        </div>

        {/* Comparison: Flagged text vs Suggested text */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 mb-3 text-xs space-y-1.5 font-mono">
          <div className="flex items-start gap-2">
            <span className="text-slate-500 text-[11px] shrink-0 w-16 uppercase font-sans font-bold">Original:</span>
            <span className="text-rose-400 line-through bg-rose-950/40 px-1 py-0.5 rounded break-all">
              {issue.originalText || '(empty)'}
            </span>
          </div>
          {issue.suggestedText && issue.suggestedText !== issue.originalText && (
            <div className="flex items-start gap-2">
              <span className="text-slate-500 text-[11px] shrink-0 w-16 uppercase font-sans font-bold">Suggested:</span>
              <span className="text-emerald-300 bg-emerald-950/40 px-1 py-0.5 rounded font-bold break-all">
                {issue.suggestedText}
              </span>
            </div>
          )}
        </div>

        {/* AI Smart Fix Suggestions Panel */}
        {showAISuggestions && (
          <div className="mb-3 p-2.5 bg-indigo-950/40 border border-indigo-700/60 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Online AI Extended Variations</span>
              </div>
              <button
                onClick={() => setShowAISuggestions(false)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {aiLoading ? (
              <div className="py-3 flex items-center justify-center gap-2 text-xs text-indigo-200">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Generating intelligent variations via Gemini...</span>
              </div>
            ) : aiError ? (
              <div className="p-2 bg-rose-950/50 border border-rose-800 rounded text-xs text-rose-300">
                {aiError}
              </div>
            ) : (
              <div className="space-y-1.5">
                {aiSuggestions.map((sug, sIdx) => (
                  <div
                    key={sIdx}
                    onClick={() => {
                      setManualText(sug.replacementText);
                      setIsManualMode(true);
                    }}
                    className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-indigo-900/60 hover:border-indigo-500 rounded-md cursor-pointer transition text-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 text-[11px]">{sug.label}</span>
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-300">Tap to adopt</span>
                    </div>
                    <div className="text-white font-mono mt-0.5 font-medium">{sug.replacementText}</div>
                    {sug.reason && (
                      <div className="text-slate-400 text-[11px] mt-0.5 leading-tight">{sug.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Edit Section */}
        {isManualMode ? (
          <form onSubmit={handleManualSubmit} className="mb-3 p-2.5 bg-slate-800/80 rounded-lg border border-blue-500/40 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-blue-300 font-medium">
              <span className="flex items-center gap-1">
                <Edit3 className="w-3 h-3 text-blue-400" />
                <span>Manual Replacement Text:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setManualText(issue.suggestedText)}
                  className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  title="Reset to suggested fix"
                >
                  Suggested
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setManualText(issue.originalText)}
                  className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  title="Reset to original text"
                >
                  Original
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Type your custom correction..."
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsManualMode(false)}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Custom Fix</span>
              </button>
            </div>
          </form>
        ) : null}

        {/* Action Buttons Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isManualMode && (
              <button
                type="button"
                onClick={() => setIsManualMode(true)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-medium transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                title="Manually type your custom edit"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span>Manual Edit</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleFetchAISuggestions}
              className="px-2.5 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 rounded-md font-medium transition flex items-center gap-1 border border-indigo-700/60 cursor-pointer"
              title="Get Gemini AI intelligent rewrite suggestions"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>AI Fixes</span>
            </button>

            {onIgnoreIssue && (
              <button
                type="button"
                onClick={() => {
                  onIgnoreIssue(issue.id);
                  onClose();
                }}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition flex items-center gap-1 cursor-pointer"
                title="Ignore this suggestion"
              >
                <EyeOff className="w-3 h-3" />
                <span>Ignore</span>
              </button>
            )}

            {onJumpToEditor && (
              <button
                type="button"
                onClick={() => {
                  onJumpToEditor(issue);
                  onClose();
                }}
                className="hidden sm:flex px-2 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition items-center gap-1 cursor-pointer"
                title="Open cursor in text editor"
              >
                <ExternalLink className="w-3 h-3" />
                <span>In Editor</span>
              </button>
            )}
          </div>

          {issue.suggestedText && issue.suggestedText !== issue.originalText && !isManualMode && (
            <button
              type="button"
              onClick={() => onApplyFix(issue)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold transition flex items-center gap-1.5 shadow-sm ml-auto cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Fix</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
