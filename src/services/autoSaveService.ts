import { AutoSaveDraft } from '../types';

const AUTOSAVE_STORAGE_KEY = 'chinghams_docuverify_autosave_draft';

export const saveDraftToLocalStorage = (draft: AutoSaveDraft): boolean => {
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch (err) {
    console.warn('Unable to auto-save to localStorage (quota or disabled):', err);
    return false;
  }
};

export const loadDraftFromLocalStorage = (): AutoSaveDraft | null => {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.content === 'string' && typeof parsed.timestamp === 'number') {
      return parsed as AutoSaveDraft;
    }
    return null;
  } catch (err) {
    console.warn('Failed to parse auto-saved draft from localStorage:', err);
    return null;
  }
};

export const clearDraftFromLocalStorage = (): void => {
  try {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear auto-saved draft:', err);
  }
};

export const formatRelativeTime = (timestamp: number): string => {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
};
