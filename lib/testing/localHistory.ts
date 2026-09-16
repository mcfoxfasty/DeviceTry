export interface LocalInspectionItem {
  id: string;
  createdAt: number;
  locale: string;
  deviceLabel: string;
  operatorName?: string;
  summaryStatus: 'passed' | 'warning' | 'failed' | 'inconclusive';
  testsResults: Record<
    string,
    {
      status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported' | 'skipped';
      classification: 'browser' | 'user' | 'inconclusive' | 'unsupported' | 'skipped';
      details?: string;
      metrics?: Record<string, unknown>;
    }
  >;
  notes?: string;
}

const LOCAL_STORAGE_KEY = 'devicetry_local_inspections';

export function getLocalInspections(): LocalInspectionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalInspection(item: Omit<LocalInspectionItem, 'id' | 'createdAt'>): LocalInspectionItem {
  const newItem: LocalInspectionItem = {
    ...item,
    id: 'local_' + Math.random().toString(36).substring(2, 11),
    createdAt: Date.now(),
  };

  if (typeof window === 'undefined') return newItem;

  try {
    const existing = getLocalInspections();
    const updated = [newItem, ...existing].slice(0, 50); // retain last 50 locally
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // quota exceeded or storage disabled
  }

  return newItem;
}

export function deleteLocalInspection(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalInspections();
    const filtered = existing.filter((i) => i.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

export function clearAllLocalInspections(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}
