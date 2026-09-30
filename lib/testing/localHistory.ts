import { TestResultItem, ReportSummaryStatus } from './reportStatus';
import { LOCAL_INSPECTIONS_KEY, notifyStorageChanged } from './storageKeys';

export { LOCAL_INSPECTIONS_KEY };

export interface LocalInspectionItem {
  id: string;
  createdAt: number;
  locale: string;
  deviceLabel: string;
  operatorName?: string;
  summaryStatus: ReportSummaryStatus;
  testsResults: Record<string, TestResultItem>;
  notes?: string;
}

const LOCAL_STORAGE_KEY = LOCAL_INSPECTIONS_KEY;

export function getLocalInspections(): LocalInspectionItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save an inspection to local history.
 * The returned item carries a `saved` flag: `false` means localStorage was
 * unavailable (SSR, disabled storage) or rejected the write (quota exceeded,
 * private mode) and the report was NOT stored. Callers must surface this
 * honestly instead of claiming the inspection was saved.
 */
export function saveLocalInspection(item: Omit<LocalInspectionItem, 'id' | 'createdAt'>): LocalInspectionItem & { saved: boolean } {
  const newItem: LocalInspectionItem = {
    ...item,
    id: 'local_' + Math.random().toString(36).substring(2, 11),
    createdAt: Date.now(),
  };

  if (typeof localStorage === 'undefined') {
    // No localStorage (SSR / storage disabled) — report accurately.
    return { ...newItem, saved: false };
  }

  try {
    const existing = getLocalInspections();
    const updated = [newItem, ...existing].slice(0, 50); // retain last 50 locally
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    // Same-tab readers (the storage inspector) never see the native `storage`
    // event, so this write has to announce itself or the inventory goes stale.
    notifyStorageChanged();
    return { ...newItem, saved: true };
  } catch {
    // quota exceeded or storage disabled — return with saved:false
    return { ...newItem, saved: false };
  }
}

export function deleteLocalInspection(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalInspections();
    const filtered = existing.filter((i) => i.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    notifyStorageChanged();
  } catch {
    // ignore
  }
}

/**
 * Update only the notes of an already-saved inspection (the notes field is
 * edited on the finished-report screen, after the automatic save). Returns
 * false when the entry could not be updated (storage unavailable/rejected)
 * so the caller can say so honestly instead of assuming it was stored.
 */
export function updateLocalInspectionNotes(id: string, notes: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const existing = getLocalInspections();
    const updated = existing.map((i) => (i.id === id ? { ...i, notes } : i));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    notifyStorageChanged();
    return true;
  } catch {
    return false;
  }
}

export function clearAllLocalInspections(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    notifyStorageChanged();
  } catch {
    // ignore
  }
}
