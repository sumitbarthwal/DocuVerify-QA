import { RecentFileRecord } from '../types';

const RECENT_FILES_STORAGE_KEY = 'chinghams_docuverify_recent_worked_files';
const MAX_RECENT_FILES = 5;

export const getRecentWorkedFiles = (): RecentFileRecord[] => {
  try {
    const raw = localStorage.getItem(RECENT_FILES_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list.filter(item => item && typeof item.content === 'string');
    }
    return [];
  } catch (err) {
    console.warn('Failed to load recent worked files from localStorage:', err);
    return [];
  }
};

export const getTop3WorkedFiles = (): RecentFileRecord[] => {
  const all = getRecentWorkedFiles();
  return all.slice(0, 3);
};

export const saveRecentWorkedFile = (
  file: {
    id?: string;
    filename: string;
    content: string;
    qualityScore?: number;
    issuesCount?: number;
    resolvedCount?: number;
    format?: string;
  }
): RecentFileRecord[] => {
  try {
    const currentList = getRecentWorkedFiles();
    const titleMatch = file.content.match(/^#\s+([^\n\r]+)/m);
    const summaryTitle = titleMatch ? titleMatch[1].trim() : file.filename.replace(/\.[^/.]+$/, '');
    const wordCount = (file.content.trim().match(/\S+/g) || []).length;
    const sizeBytes = new Blob([file.content]).size;

    const fileId = file.id || `doc_${file.filename.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const newRecord: RecentFileRecord = {
      id: fileId,
      filename: file.filename,
      content: file.content,
      lastWorkedAt: Date.now(),
      sizeBytes,
      wordCount,
      qualityScore: file.qualityScore ?? 85,
      issuesCount: file.issuesCount ?? 0,
      resolvedCount: file.resolvedCount ?? 0,
      summaryTitle,
      format: file.format || file.filename.split('.').pop()?.toUpperCase() || 'DOCX',
    };

    // Filter out existing record with same id or filename to avoid duplicates
    const filtered = currentList.filter(item => item.id !== fileId && item.filename !== file.filename);

    // Prepend as most recent
    const updated = [newRecord, ...filtered].slice(0, MAX_RECENT_FILES);

    localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save worked file to localStorage:', err);
    return getRecentWorkedFiles();
  }
};

export const deleteRecentWorkedFile = (id: string): RecentFileRecord[] => {
  try {
    const currentList = getRecentWorkedFiles();
    const updated = currentList.filter(item => item.id !== id);
    localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to delete recent worked file:', err);
    return getRecentWorkedFiles();
  }
};

export const clearAllRecentFiles = (): void => {
  try {
    localStorage.removeItem(RECENT_FILES_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear recent files:', err);
  }
};
