/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { DocumentEditor } from './components/DocumentEditor';
import { QASidebar } from './components/QASidebar';
import { PrivacyModal } from './components/PrivacyModal';
import { AuditSummaryModal } from './components/AuditSummaryModal';
import { SettingsModal } from './components/SettingsModal';
import { MetricCrossCheckerModal } from './components/MetricCrossCheckerModal';
import { RecentFilesModal } from './components/RecentFilesModal';
import { HeaderFooterModal } from './components/HeaderFooterModal';
import { ExportPreviewModal } from './components/ExportPreviewModal';
import { 
  QAIssue, 
  ReportStats, 
  RuleConfig, 
  SampleReport, 
  QACategory,
  RecentFileRecord
} from './types';
import { 
  runFullDocumentQA, 
  applySingleFix, 
  applyAllVerifiedFixes, 
  applyCategoryFixes, 
  DEFAULT_RULE_CONFIG 
} from './services/qaEngine';
import { SAMPLE_REPORTS } from './services/sampleReports';
import { printAuditCertificate } from './services/exportService';
import { 
  parseImportedDocument,
  exportToWordDocument,
  exportToPDF,
  exportToRTF,
  exportToHTMLDocument,
  exportToCSVExtract,
  exportToMarkdownFile,
  exportToPlainText,
  exportToAuditJSON
} from './services/documentFormatsService';
import {
  patchDocxArrayBuffer,
  createStandardDocxPackage
} from './services/docxEngineService';
import { 
  saveDraftToLocalStorage, 
  loadDraftFromLocalStorage, 
  clearDraftFromLocalStorage 
} from './services/autoSaveService';
import { 
  getRecentWorkedFiles, 
  saveRecentWorkedFile, 
  deleteRecentWorkedFile, 
  clearAllRecentFiles 
} from './services/recentFilesService';
import { CheckCircle2, Loader2, FileText } from 'lucide-react';
import { 
  checkAIServerStatus, 
  runAIExtendedAudit, 
  AIServiceStatus 
} from './services/aiAuditService';

export default function App() {
  // Initialize document state with realistic financial sample
  const [content, setContent] = useState<string>(SAMPLE_REPORTS[0].content);
  const [filename, setFilename] = useState<string>('Q3_Executive_Financial_Report.docx');
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading document...');

  // History stack for Undo / Redo
  const [history, setHistory] = useState<string[]>([SAMPLE_REPORTS[0].content]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Configuration
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>(DEFAULT_RULE_CONFIG);

  // Selected issue
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // UI modal state
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'qa'>('editor');
  const [privacyModalOpen, setPrivacyModalOpen] = useState<boolean>(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [metricModalOpen, setMetricModalOpen] = useState<boolean>(false);
  const [recentModalOpen, setRecentModalOpen] = useState<boolean>(false);
  const [headerFooterModalOpen, setHeaderFooterModalOpen] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [headerText, setHeaderText] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Original DOCX array buffer & extracted images for authentic Microsoft Word preview and export
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [documentImages, setDocumentImages] = useState<Array<{ name: string; dataUrl: string }>>([]);

  // Track session resolution metrics for the visual progress bar
  const [sessionResolvedCount, setSessionResolvedCount] = useState<number>(0);
  const [sessionBaselineTotal, setSessionBaselineTotal] = useState<number>(0);

  // Auto-Save timestamp
  const [autoSaveTimestamp, setAutoSaveTimestamp] = useState<number | null>(null);

  // Recent files state
  const [recentFiles, setRecentFiles] = useState<RecentFileRecord[]>(() => {
    return getRecentWorkedFiles();
  });

  // Track whether initial mount has loaded draft
  const initialMounted = useRef(false);

  // AI Extended Audit State
  const [isAiScanning, setIsAiScanning] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<AIServiceStatus | null>(null);
  const [aiIssues, setAiIssues] = useState<QAIssue[]>([]);
  const [loadingPercent, setLoadingPercent] = useState<number | null>(null);

  // Check AI backend capabilities on mount
  useEffect(() => {
    checkAIServerStatus().then((status) => {
      setAiStatus(status);
    });
  }, []);

  // Debounce QA engine execution on heavy documents to guarantee silky-smooth typing with zero frame drops
  const [debouncedContent, setDebouncedContent] = useState(content);

  useEffect(() => {
    // Immediate for small documents (< 20,000 characters), slight debounce (180ms) for massive multi-page documents
    const delay = content.length > 20000 ? 180 : 20;
    const timer = setTimeout(() => {
      setDebouncedContent(content);
    }, delay);
    return () => clearTimeout(timer);
  }, [content]);

  // Run QA Engine whenever debounced content or configuration changes
  const qaResult = useMemo(() => {
    return runFullDocumentQA(debouncedContent, ruleConfig);
  }, [debouncedContent, ruleConfig]);

  // Combine offline deterministic issues with online AI findings
  const combinedIssues = useMemo(() => {
    if (aiIssues.length === 0) return qaResult.issues;
    const flaggedTexts = new Set(qaResult.issues.map((i) => i.originalText.trim().toLowerCase()));
    const nonDuplicatedAi = aiIssues.filter((ai) => {
      if (!ai.originalText) return false;
      return !flaggedTexts.has(ai.originalText.trim().toLowerCase()) && debouncedContent.includes(ai.originalText);
    });
    return [...qaResult.issues, ...nonDuplicatedAi];
  }, [qaResult.issues, aiIssues, debouncedContent]);

  const issues = combinedIssues;
  const stats = qaResult.stats;

  // Handler for triggering online AI extended scan
  const handleTriggerAiScan = async () => {
    if (isAiScanning) return;
    setIsAiScanning(true);
    showToast('Initiating Gemini 3.8 Flash extended deep audit...');

    try {
      const res = await runAIExtendedAudit(content, filename);
      if (res.success && res.issues) {
        setAiIssues(res.issues);
        showToast(`AI Extended Scan: ${res.issues.length} intelligent findings flagged!`);
      } else {
        showToast(`AI Scan notice: ${res.error || 'No additional issues found'}`);
      }
    } catch (err: any) {
      showToast(`AI Scan error: ${err.message}`);
    } finally {
      setIsAiScanning(false);
    }
  };

  // Initialize baseline total whenever document loads
  useEffect(() => {
    if (issues.length > 0 && sessionBaselineTotal === 0) {
      setSessionBaselineTotal(issues.length);
    }
  }, [issues, sessionBaselineTotal]);

  // Push new state to history stack
  const updateContentWithHistory = useCallback((newContent: string) => {
    setContent(newContent);
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newContent];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setContent(history[newIdx]);
      showToast('Action undone');
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setContent(history[newIdx]);
      showToast('Action redone');
    }
  }, [historyIndex, history]);

  // Keyboard shortcut listener for Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

  // -------------------------------------------------------------
  // AUTO-SAVE: Check and restore on first mount
  // -------------------------------------------------------------
  useEffect(() => {
    if (initialMounted.current) return;
    initialMounted.current = true;

    const savedDraft = loadDraftFromLocalStorage();
    if (savedDraft && savedDraft.content && savedDraft.content.trim().length > 0) {
      // Check if saved draft differs from default sample
      if (savedDraft.content !== SAMPLE_REPORTS[0].content) {
        setContent(savedDraft.content);
        setFilename(savedDraft.filename || 'Restored_Audit_Document.docx');
        setHistory([savedDraft.content]);
        setHistoryIndex(0);
        setSessionResolvedCount(savedDraft.sessionResolvedCount || 0);
        setSessionBaselineTotal(savedDraft.sessionBaselineTotal || 0);
        setAutoSaveTimestamp(savedDraft.timestamp);
        showToast('Auto-saved audit draft restored from your last session');
        return;
      }
    }

    // Seed initial worked file into history if empty
    const currentRecent = getRecentWorkedFiles();
    if (currentRecent.length === 0) {
      const seeded = saveRecentWorkedFile({
        filename: 'Q3_Executive_Financial_Report.docx',
        content: SAMPLE_REPORTS[0].content,
        qualityScore: 88,
        issuesCount: 4,
        resolvedCount: 0,
        format: 'DOCX'
      });
      setRecentFiles(seeded);
    }

    // Generate initial authentic DOCX package for default sample
    createStandardDocxPackage(SAMPLE_REPORTS[0].content, {
      title: SAMPLE_REPORTS[0].title,
      headerText: `${SAMPLE_REPORTS[0].title} | QA Verification Draft`,
      footerText: "Chingham's DocuVerify Quality Assurance Engine",
    }).then((buf) => {
      setDocxBuffer(buf);
    }).catch(() => {});
  }, []);

  // -------------------------------------------------------------
  // AUTO-SAVE: Debounced persistence on content/metrics updates
  // -------------------------------------------------------------
  useEffect(() => {
    if (!initialMounted.current) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      saveDraftToLocalStorage({
        content,
        filename,
        timestamp: now,
        sessionResolvedCount,
        sessionBaselineTotal,
      });
      setAutoSaveTimestamp(now);

      // Also keep recent worked files in sync
      const updatedList = saveRecentWorkedFile({
        filename,
        content,
        qualityScore: stats.qualityScore,
        issuesCount: issues.length,
        resolvedCount: sessionResolvedCount,
        format: filename.split('.').pop()?.toUpperCase() || 'DOCX',
      });
      setRecentFiles(updatedList);
    }, 600);

    return () => clearTimeout(timer);
  }, [content, filename, sessionResolvedCount, sessionBaselineTotal, stats.qualityScore, issues.length]);

  // Sample report selection
  const handleSelectSample = (sample: SampleReport) => {
    setContent(sample.content);
    setFilename(`${sample.id}.docx`);
    setHistory([sample.content]);
    setHistoryIndex(0);
    setSelectedIssueId(null);
    setSessionResolvedCount(0);
    setSessionBaselineTotal(0);

    // Create authentic DOCX package for Word Layout view
    createStandardDocxPackage(sample.content, {
      title: sample.title,
      headerText: `${sample.title} | QA Verification Draft`,
      footerText: "Chingham's DocuVerify Quality Assurance Engine",
    }).then((buf) => {
      setDocxBuffer(buf);
    }).catch(() => {
      setDocxBuffer(null);
    });

    // Save to recent files
    const updated = saveRecentWorkedFile({
      filename: `${sample.id}.docx`,
      content: sample.content,
      qualityScore: 85,
      issuesCount: 5,
      resolvedCount: 0,
      format: 'DOCX',
    });
    setRecentFiles(updated);
    showToast(`Loaded sample: ${sample.title}`);
  };

  // -------------------------------------------------------------
  // RECENT FILES: Quick Load, Rework, View, Download
  // -------------------------------------------------------------
  const handleQuickLoadRecent = (file: RecentFileRecord) => {
    setContent(file.content);
    setFilename(file.filename);
    setHistory([file.content]);
    setHistoryIndex(0);
    setSelectedIssueId(null);
    setSessionResolvedCount(file.resolvedCount || 0);
    setSessionBaselineTotal(file.issuesCount || 0);

    // Bump to top of recent files
    const updated = saveRecentWorkedFile(file);
    setRecentFiles(updated);
    showToast(`Quick loaded: ${file.filename}`);
  };

  const handleReworkRecent = (file: RecentFileRecord) => {
    setContent(file.content);
    setFilename(file.filename);
    setHistory([file.content]);
    setHistoryIndex(0);
    setSelectedIssueId(null);
    // Reset resolution counters for a fresh audit pass
    setSessionResolvedCount(0);
    setSessionBaselineTotal(0);

    const updated = saveRecentWorkedFile(file);
    setRecentFiles(updated);
    setActiveMobileTab('editor');
    showToast(`Rework mode active: Fresh QA audit ready for ${file.filename}`);
  };

  const handleViewRecent = (file: RecentFileRecord) => {
    setRecentModalOpen(true);
  };

  const handleDownloadRecent = (file: RecentFileRecord) => {
    exportToWordDocument(file.content, file.filename);
    showToast(`Downloaded Word document for ${file.filename}`);
  };

  // -------------------------------------------------------------
  // MULTI-FORMAT FILE IMPORT (.docx, .doc, .pdf, .rtf, .html, .csv, .tsv, .json, .txt, .md)
  // -------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Safety guardrail: Browsers have hard JavaScript heap memory limits.
    // Heavy documents (>50MB) containing high-res uncompressed media can cause tab memory allocation failures.
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 50 MB safety threshold. Please compress or select a text/word document.`);
      e.target.value = '';
      return;
    }

    setIsFileLoading(true);
    setLoadingPercent(5);
    setLoadingMessage(`Reading ${file.name} (${(file.size / 1024).toFixed(0)} KB)...`);

    try {
      // Yield to main thread so the loading overlay renders immediately
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await parseImportedDocument(file, (msg, pct) => {
        setLoadingMessage(msg);
        if (pct !== undefined) setLoadingPercent(pct);
      });

      setLoadingMessage(`Formatting and paginating document structure...`);
      setLoadingPercent(95);
      await new Promise(resolve => setTimeout(resolve, 30));

      updateContentWithHistory(result.content);
      setDebouncedContent(result.content);
      setFilename(result.filename);
      setSelectedIssueId(null);
      setSessionResolvedCount(0);
      setSessionBaselineTotal(0);

      // Preserve genuine DOCX buffer and images for authentic Word layout view and export
      if (result.rawDocxBuffer) {
        setDocxBuffer(result.rawDocxBuffer);
      } else {
        setDocxBuffer(null);
      }
      if (result.images && result.images.length > 0) {
        setDocumentImages(result.images);
      } else {
        setDocumentImages([]);
      }

      // Preserve original running header & footer from imported file
      if (result.headerText) {
        setHeaderText(result.headerText);
      } else {
        setHeaderText('');
      }
      if (result.footerText) {
        setFooterText(result.footerText);
      } else {
        setFooterText('');
      }

      // Track in recent files
      const updated = saveRecentWorkedFile({
        filename: result.filename,
        content: result.content,
        qualityScore: 85,
        issuesCount: 0,
        resolvedCount: 0,
        format: result.format,
      });
      setRecentFiles(updated);

      const headerInfo = result.headerText ? ' with original running headers/footers' : '';
      showToast(`Imported ${result.filename} (${result.format}, ${result.wordCount} words)${headerInfo}`);
    } catch (err: any) {
      console.error('File import error:', err);
      showToast('Error reading document file. Please ensure format is valid.');
    } finally {
      setIsFileLoading(false);
      setLoadingPercent(null);
      e.target.value = '';
    }
  };

  // Apply single fix
  const handleApplyIssue = async (issue: QAIssue) => {
    const updated = applySingleFix(content, issue);
    updateContentWithHistory(updated);
    if (docxBuffer && issue.originalText && issue.suggestedText) {
      try {
        const patched = await patchDocxArrayBuffer(docxBuffer, [{
          oldText: issue.originalText,
          newText: issue.suggestedText,
        }]);
        setDocxBuffer(patched);
      } catch (e) {
        console.warn('Could not patch docx buffer:', e);
      }
    }
    setSelectedIssueId(null);
    setSessionResolvedCount((prev) => prev + 1);
    showToast(`Applied fix: "${issue.suggestedText}"`);
  };

  // Apply manual edit directly from the floating box or modal
  const handleApplyManualFix = async (issue: QAIssue, customText: string) => {
    if (issue.startOffset >= 0 && issue.endOffset <= content.length) {
      const updated = content.slice(0, issue.startOffset) + customText + content.slice(issue.endOffset);
      updateContentWithHistory(updated);
      if (docxBuffer && issue.originalText) {
        try {
          const patched = await patchDocxArrayBuffer(docxBuffer, [{
            oldText: issue.originalText,
            newText: customText,
          }]);
          setDocxBuffer(patched);
        } catch (e) {
          console.warn('Could not patch docx buffer:', e);
        }
      }
      setSelectedIssueId(null);
      setSessionResolvedCount((prev) => prev + 1);
      showToast(`Applied manual edit: "${customText}"`);
    }
  };

  // Ignore issue
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const handleIgnoreIssue = (issueId: string) => {
    setIgnoredIds((prev) => new Set([...prev, issueId]));
    if (selectedIssueId === issueId) {
      setSelectedIssueId(null);
    }
    setSessionResolvedCount((prev) => prev + 1);
    showToast('Alert dismissed');
  };

  // Filter issues taking ignored into account
  const activeFilteredIssues = useMemo(() => {
    return issues.map(iss => ({
      ...iss,
      ignored: ignoredIds.has(iss.id),
    }));
  }, [issues, ignoredIds]);

  // Master Auto-Apply on User Pass
  const handleApplyAllVerified = async () => {
    const { updatedText, appliedCount, replacements } = applyAllVerifiedFixes(content, activeFilteredIssues);
    if (appliedCount > 0) {
      updateContentWithHistory(updatedText);
      if (docxBuffer && replacements.length > 0) {
        try {
          const patched = await patchDocxArrayBuffer(docxBuffer, replacements);
          setDocxBuffer(patched);
        } catch (e) {
          console.warn('Could not patch docx buffer:', e);
        }
      }
      setSelectedIssueId(null);
      setSessionResolvedCount((prev) => prev + appliedCount);
      showToast(`Successfully auto-applied ${appliedCount} verified QA corrections!`);
    } else {
      showToast('No auto-applicable fixes remain in the document.');
    }
  };

  // Category Bulk Apply
  const handleApplyCategory = async (category: QACategory) => {
    const { updatedText, appliedCount, replacements } = applyCategoryFixes(content, activeFilteredIssues, category);
    if (appliedCount > 0) {
      updateContentWithHistory(updatedText);
      if (docxBuffer && replacements.length > 0) {
        try {
          const patched = await patchDocxArrayBuffer(docxBuffer, replacements);
          setDocxBuffer(patched);
        } catch (e) {
          console.warn('Could not patch docx buffer:', e);
        }
      }
      setSelectedIssueId(null);
      setSessionResolvedCount((prev) => prev + appliedCount);
      showToast(`Applied ${appliedCount} ${category} corrections.`);
    } else {
      showToast(`No auto-applicable fixes found for ${category}.`);
    }
  };

  // Calculate resolution progress metrics
  const activeRemainingCount = activeFilteredIssues.filter(i => !i.ignored).length;
  const effectiveTotalCount = Math.max(
    sessionBaselineTotal, 
    sessionResolvedCount + activeRemainingCount, 
    activeRemainingCount
  );
  const effectiveResolvedCount = effectiveTotalCount > 0 
    ? Math.max(0, effectiveTotalCount - activeRemainingCount) 
    : 0;
  const resolvedPercentage = effectiveTotalCount > 0 
    ? Math.min(100, Math.round((effectiveResolvedCount / effectiveTotalCount) * 100))
    : (activeRemainingCount === 0 ? 100 : 0);

  // -------------------------------------------------------------
  // MULTI-FORMAT EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleExportWord = async () => {
    await exportToWordDocument(content, filename, headerText, footerText, docxBuffer);
    showToast('Downloaded Microsoft Word document (.docx) with original headers & footers');
  };

  const handleExportPDF = () => {
    exportToPDF(content, filename, headerText, footerText);
    showToast('Print dialog opened for PDF export');
  };

  const handleExportRTF = () => {
    exportToRTF(content, filename);
    showToast('Downloaded Rich Text document (.rtf)');
  };

  const handleExportHTML = () => {
    exportToHTMLDocument(content, filename);
    showToast('Downloaded Standalone HTML document (.html)');
  };

  const handleExportCSV = () => {
    exportToCSVExtract(content, filename);
    showToast('Extracted and downloaded document data tables (.csv)');
  };

  const handleExportMarkdown = () => {
    exportToMarkdownFile(content, filename);
    showToast('Downloaded Markdown document (.md)');
  };

  const handleExportText = () => {
    exportToPlainText(content, filename);
    showToast('Downloaded plain text document (.txt)');
  };

  const handleExportJSON = () => {
    exportToAuditJSON(content, filename, stats, activeFilteredIssues);
    showToast('Downloaded QA Audit package (.json)');
  };

  const handlePrintCertificate = () => {
    printAuditCertificate(stats, activeFilteredIssues, filename);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navigation */}
      <Navbar
        filename={filename}
        stats={stats}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSelectSample={handleSelectSample}
        onFileUpload={handleFileUpload}
        onExportWord={handleExportWord}
        onExportPDF={handleExportPDF}
        onExportRTF={handleExportRTF}
        onExportHTML={handleExportHTML}
        onExportCSV={handleExportCSV}
        onExportMarkdown={handleExportMarkdown}
        onExportText={handleExportText}
        onExportJSON={handleExportJSON}
        onPrintCertificate={handlePrintCertificate}
        onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
        onOpenSummaryModal={() => setSummaryModalOpen(true)}
        onOpenMetricCrossCheckerModal={() => setMetricModalOpen(true)}
        activeMobileTab={activeMobileTab}
        onToggleMobileTab={setActiveMobileTab}
        totalIssuesCount={activeFilteredIssues.filter(i => !i.ignored).length}
        recentFiles={recentFiles}
        onQuickLoadRecent={handleQuickLoadRecent}
        onReworkRecent={handleReworkRecent}
        onViewRecent={handleViewRecent}
        onDownloadRecent={handleDownloadRecent}
        onOpenRecentModal={() => setRecentModalOpen(true)}
        autoSaveTimestamp={autoSaveTimestamp}
        onTriggerAiScan={handleTriggerAiScan}
        isAiScanning={isAiScanning}
        aiAvailable={aiStatus?.available ?? true}
        onOpenExportPreview={() => setExportModalOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 min-h-[calc(100vh-4rem)]">
        {/* Left / Primary: Document Editor Canvas */}
        <div className={`md:col-span-7 lg:col-span-8 h-[calc(100vh-7rem)] flex flex-col ${
          activeMobileTab === 'editor' ? 'block' : 'hidden md:flex'
        }`}>
          <DocumentEditor
            content={content}
            onChange={updateContentWithHistory}
            issues={activeFilteredIssues.filter(i => !i.ignored)}
            stats={stats}
            selectedIssueId={selectedIssueId}
            onSelectIssue={setSelectedIssueId}
            headerText={headerText}
            footerText={footerText}
            docxBuffer={docxBuffer}
            onDocxBufferChange={setDocxBuffer}
            images={documentImages}
            onOpenHeaderFooterModal={() => setHeaderFooterModalOpen(true)}
            onApplyFix={handleApplyIssue}
            onApplyManualFix={handleApplyManualFix}
            onIgnoreIssue={handleIgnoreIssue}
            onOpenExportPreview={() => setExportModalOpen(true)}
          />
        </div>

        {/* Right / Secondary: QA Audit Verification Center */}
        <div className={`md:col-span-5 lg:col-span-4 h-[calc(100vh-7rem)] flex flex-col ${
          activeMobileTab === 'qa' ? 'block' : 'hidden md:flex'
        }`}>
          <QASidebar
            issues={activeFilteredIssues}
            onApplyIssue={handleApplyIssue}
            onIgnoreIssue={handleIgnoreIssue}
            onApplyAllVerified={handleApplyAllVerified}
            onApplyCategory={handleApplyCategory}
            selectedIssueId={selectedIssueId}
            onSelectIssue={(id) => {
              setSelectedIssueId(id);
              if (id) {
                setActiveMobileTab('editor');
              }
            }}
            resolvedCount={effectiveResolvedCount}
            totalIssuesCount={effectiveTotalCount}
            resolvedPercentage={resolvedPercentage}
            deepScanActive={ruleConfig.deepScan}
            onTriggerAiScan={handleTriggerAiScan}
            isAiScanning={isAiScanning}
            aiAvailable={aiStatus?.available ?? true}
          />
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <PrivacyModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      <AuditSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        stats={stats}
        issues={activeFilteredIssues}
        filename={filename}
        onPrintCertificate={handlePrintCertificate}
        onExportWord={handleExportWord}
        onSelectIssue={(issueId) => {
          setSelectedIssueId(issueId);
          setActiveMobileTab('editor');
          showToast('Jumped to issue in document');
        }}
        content={content}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        config={ruleConfig}
        onChangeConfig={setRuleConfig}
      />

      <MetricCrossCheckerModal
        isOpen={metricModalOpen}
        onClose={() => setMetricModalOpen(false)}
        metrics={stats.extractedMetrics || []}
        onSelectOffset={(start, end) => {
          const matchingIssue = activeFilteredIssues.find(i => 
            (i.startOffset <= start && i.endOffset >= start) || 
            (i.startOffset >= start && i.startOffset <= end)
          );
          if (matchingIssue) {
            setSelectedIssueId(matchingIssue.id);
          }
          setActiveMobileTab('editor');
          setMetricModalOpen(false);
          showToast('Jumped to metric in document');
        }}
      />

      <HeaderFooterModal
        isOpen={headerFooterModalOpen}
        onClose={() => setHeaderFooterModalOpen(false)}
        headerText={headerText}
        footerText={footerText}
        autoHeader={`Survey & Assessment Report | Ref: SRV-REF-AUTO`}
        autoFooter={`Chingham's DocuVerify QA Audit Engine`}
        onSave={(h, f) => {
          setHeaderText(h);
          setFooterText(f);
          showToast('Updated original running header & footer fidelity settings');
        }}
      />

      <RecentFilesModal
        isOpen={recentModalOpen}
        onClose={() => setRecentModalOpen(false)}
        recentFiles={recentFiles}
        onLoadFile={handleQuickLoadRecent}
        onReworkFile={handleReworkRecent}
        onDeleteFile={(id) => setRecentFiles(deleteRecentWorkedFile(id))}
        onClearAll={() => {
          clearAllRecentFiles();
          setRecentFiles([]);
          showToast('Cleared recent files history');
        }}
      />

      <ExportPreviewModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        content={content}
        filename={filename}
        stats={stats}
        issues={activeFilteredIssues}
        headerText={headerText}
        footerText={footerText}
        docxBuffer={docxBuffer}
        onShowToast={showToast}
      />

      {/* Document Loading & Processing Overlay */}
      {isFileLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">
              Processing Document
            </h3>
            <p className="text-xs text-slate-500 mb-3 min-h-[32px] flex items-center justify-center">
              {loadingMessage}
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1.5">
              {loadingPercent !== null ? (
                <div 
                  className="bg-blue-600 h-full transition-all duration-200 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(8, loadingPercent))}%` }}
                />
              ) : (
                <div className="bg-blue-600 h-full w-2/3 animate-pulse rounded-full" />
              )}
            </div>
            {loadingPercent !== null && (
              <span className="text-[11px] font-mono font-semibold text-slate-400">
                {loadingPercent}% Complete
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
