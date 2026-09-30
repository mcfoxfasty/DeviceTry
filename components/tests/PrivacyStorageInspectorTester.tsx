'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, Trash2, Download, FileText, AlertTriangle, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import { getLocalInspections, LocalInspectionItem } from '@/lib/testing/localHistory';
import { TEST_HISTORY_CHANGE_EVENT } from '@/lib/testing/testHistory';
import { STORAGE_CHANGE_EVENT } from '@/lib/testing/storageKeys';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  DeleteOutcome,
  KeyInventoryRow,
  StorageAdapter,
  StorageSnapshot,
  buildBackup,
  clearOwnedStorage,
  collectStorageSnapshot,
  hasExportableData,
} from '@/lib/testing/storageInspector';
import { useResetPulse } from './useResetSignal';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured' | 'unsupported',
    details?: string,
    metrics?: Record<string, unknown>
  ) => void;
  onResultClear?: () => void;
  /** Increments whenever the host clears its banner. */
  resetSignal?: number;
}

/** The live localStorage behind an adapter, or null when it cannot be read. */
function liveAdapter(): StorageAdapter | null {
  try {
    const store = window.localStorage;
    // Touch it: Safari private mode and blocked-cookie settings throw here
    // rather than on the first read, and that must be visible in the UI.
    store.length;
    return {
      keys: () => {
        const out: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key !== null) out.push(key);
        }
        return out;
      },
      getItem: (key) => store.getItem(key),
      removeItem: (key) => store.removeItem(key),
    };
  } catch {
    return null;
  }
}

function readVisibleCookies(): { value: string | null; readable: boolean } {
  try {
    return { value: document.cookie, readable: true };
  } catch {
    return { value: null, readable: false };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function PrivacyStorageInspectorTester({ onResultUpdate, onResultClear, resetSignal }: TesterProps) {
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null);
  const [inspections, setInspections] = useState<LocalInspectionItem[]>([]);
  const [outcome, setOutcome] = useState<DeleteOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const generationRef = useRef(0);

  const refresh = useCallback(() => {
    const generation = ++generationRef.current;
    const adapter = liveAdapter();
    const cookies = readVisibleCookies();
    const next = adapter
      ? collectStorageSnapshot({ storage: adapter, visibleCookie: cookies.readable ? cookies.value : undefined })
      : collectStorageSnapshot({
          storage: {
            keys: () => {
              throw new Error('localStorage is blocked or unavailable for this site');
            },
            getItem: () => null,
            removeItem: () => undefined,
          },
        });
    if (generationRef.current !== generation) return;
    setSnapshot(next);
    setInspections(adapter ? getLocalInspections() : []);
  }, []);

  useEffect(() => {
    // Initial refresh deferred to a frame callback so no setState happens
    // synchronously in the effect body. History writes in this tab do not fire
    // a `storage` event, so the shared same-tab event is subscribed to as well.
    const raf = requestAnimationFrame(refresh);
    window.addEventListener(TEST_HISTORY_CHANGE_EVENT, refresh);
    // Any owned-key writer (test history, saved inspections, rerun comparison,
    // theme) announces itself here. Without it this table keeps showing the
    // pre-write state — including reporting a key as absent while it holds data.
    window.addEventListener(STORAGE_CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(TEST_HISTORY_CHANGE_EVENT, refresh);
      window.removeEventListener(STORAGE_CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      generationRef.current += 1;
    };
  }, [refresh]);

  const exportBackup = () => {
    const adapter = liveAdapter();
    if (!adapter || !snapshot || !hasExportableData(snapshot)) return;
    const payload = buildBackup({ storage: adapter, now: () => Date.now() });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devicetry-backup-${BACKUP_FORMAT}-v${BACKUP_VERSION}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onResultUpdate?.(
      'measured',
      `Exported a versioned ${BACKUP_FORMAT} file (v${BACKUP_VERSION}) containing ${payload.testHistory.length} test history entr${
        payload.testHistory.length === 1 ? 'y' : 'ies'
      } and ${payload.inspections.length} inspection(s) from this browser. The file is saved on your device; nothing was uploaded.`,
      { testHistoryEntries: payload.testHistory.length, inspections: payload.inspections.length }
    );
  };

  const clearAll = () => {
    if (!snapshot || snapshot.storageReadable) {
      const ok = window.confirm(
        'Clear DeviceTry data stored in this browser?\n\nThis permanently removes your individual test history, saved guided inspections, rerun-comparison values and theme choice. It cannot be undone.'
      );
      if (!ok) return;
    }
    setBusy(true);
    const adapter = liveAdapter();
    if (!adapter) {
      setBusy(false);
      setOutcome(null);
      onResultUpdate?.(
        'failed',
        'Nothing was deleted: localStorage is blocked or unavailable for this site, so its contents cannot be read or cleared from a page.'
      );
      return;
    }
    const result = clearOwnedStorage({ storage: adapter });
    setBusy(false);
    setOutcome(result);
    // Other surfaces (test history list) subscribe to this same-tab event.
    window.dispatchEvent(new Event(TEST_HISTORY_CHANGE_EVENT));
    refresh();

    onResultUpdate?.(
      result.complete ? 'measured' : 'failed',
      result.complete
        ? `Verified deletion: ${result.removed.length} owned localStorage key(s) were removed and re-checked as absent ` +
          'at the moment of that check. ' +
          'Nothing else was touched — cookies, IndexedDB, Cache Storage and other origins are not cleared here, and this site holds no account. ' +
          'Recording this result then writes entries of its own, so test history and comparison values can reappear straight away — ' +
          'that is this deletion being reported, not the deleted data coming back.'
        : result.summary,
      { keysRemoved: result.removed.length, keysFailed: result.failed.length }
    );
  };

  const resetAll = () => {
    generationRef.current += 1;
    setSnapshot(null);
    setInspections([]);
    setOutcome(null);
    setBusy(false);
    onResultClear?.();
    refresh();
  };

  const blocked = snapshot !== null && !snapshot.storageReadable;

  // A host clear wipes the deletion report; the inventory itself is re-read so
  // the card never describes a state the user asked to discard.
  useResetPulse(resetSignal, () => {
    setOutcome(null);
    refresh();
  });
  const exportable = snapshot !== null && hasExportableData(snapshot);
  const totalBytes = snapshot?.totalBytes ?? 0;
  const rows: KeyInventoryRow[] = snapshot?.keys ?? [];

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">DeviceTry Privacy &amp; Data Inspector</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              Every localStorage key this site owns — view, export or wipe
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {snapshot && (
            <button
              onClick={resetAll}
              title="Re-read localStorage and update this table"
              aria-label="Refresh: re-read localStorage and update this table"
              className="px-3 py-2 rounded-lg border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Refresh
            </button>
          )}
          <button
            onClick={exportBackup}
            disabled={!exportable}
            title={exportable ? 'Export the data listed below as JSON' : 'Nothing exportable is stored yet'}
            className="px-3 py-2 rounded-lg bg-white dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] text-[#142033] dark:text-[#E9EEF4] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export Backup
          </button>
          <button
            onClick={clearAll}
            disabled={busy || blocked || rows.every((row) => !row.present)}
            title={blocked ? 'localStorage is blocked for this site' : 'Delete the DeviceTry keys listed below'}
            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Clear Owned Data
          </button>
        </div>
      </div>

      {blocked && (
        <div className="mt-4 p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Storage is unavailable, not empty.</p>
          <p className="mt-1 break-words">
            Reading localStorage threw ({snapshot?.readError}). Nothing could be inspected, exported or deleted, and this page
            cannot tell you whether data exists. Allow site data for this origin in the browser&apos;s address-bar settings,
            then reload.
          </p>
        </div>
      )}

      {outcome && (
        <div
          className={`mt-4 p-3 rounded-lg text-xs border ${
            outcome.complete
              ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
              : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200'
          }`}
        >
          <p className="break-words">{outcome.summary}</p>
          {outcome.failed.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {outcome.failed.map((failure) => (
                <li key={failure.key} className="break-words">
                  {failure.key}: {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {snapshot && (
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
              Test history
            </p>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">
              {snapshot.storageReadable ? snapshot.testHistoryCount : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">individual test results</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
              Guided inspections
            </p>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">
              {snapshot.storageReadable ? snapshot.inspectionCount : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">saved multi-test reports</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Owned keys</p>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">
              {snapshot.storageReadable ? `${snapshot.presentKeyCount} / ${rows.length}` : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">{formatBytes(totalBytes)} stored</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
              JS-visible cookies
            </p>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">
              {snapshot.cookieReadable ? snapshot.visibleCookieCount : 'Not readable'}
            </p>
            <p className="mt-0.5 text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">document.cookie, not HttpOnly</p>
          </div>
        </div>
      )}

      {inspections.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] mb-2">
            Saved guided inspections
          </p>
          <div className="space-y-2">
            {inspections.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6] shrink-0" aria-hidden="true" />
                  <span className="font-medium text-[#142033] dark:text-[#E9EEF4] truncate">{item.deviceLabel}</span>
                  <span className="text-[#5F6B7A] dark:text-[#9AA6B8] shrink-0">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    item.summaryStatus === 'passed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.summaryStatus === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : item.summaryStatus === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.summaryStatus}
                </span>
              </div>
            ))}
            {inspections.length > 6 && (
              <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">…and {inspections.length - 6} more record(s)</p>
            )}
          </div>
        </div>
      )}

      {snapshot?.storageReadable && rows.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] mb-2">
            DeviceTry-owned localStorage keys
          </p>
          <ScrollableTable label="DeviceTry owned localStorage keys" minWidthClass="min-w-[620px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F9] dark:bg-[#192332]">
                <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
                  <th scope="col" className="py-2 px-4 font-semibold">Key</th>
                  <th scope="col" className="py-2 px-4 font-semibold">What it holds</th>
                  <th scope="col" className="py-2 px-4 font-semibold text-right">Size</th>
                  <th scope="col" className="py-2 px-4 font-semibold">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                {rows.map((row) => (
                  <tr key={row.key} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                    <td className="py-2.5 px-4 font-mono-num text-[#142033] dark:text-[#E9EEF4] break-all">{row.key}</td>
                    <td className="py-2.5 px-4 text-[#5F6B7A] dark:text-[#9AA6B8]">{row.holds}</td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-[#5F6B7A] dark:text-[#9AA6B8]">
                      {row.present ? formatBytes(row.sizeBytes) : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.present
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-[#192332] dark:text-[#9AA6B8]'
                        }`}
                      >
                        {row.present ? 'stored' : 'absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          {snapshot.otherKeys.length > 0 && (
            <p className="mt-2 text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] break-words">
              {snapshot.otherKeys.length} other localStorage key(s) exist for this origin ({snapshot.otherKeys.join(', ')}).
              They are listed because they are visible here, but this page neither claims nor deletes them.
            </p>
          )}
        </div>
      )}

      {snapshot?.storageReadable && rows.every((row) => !row.present) && (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
          Storage is readable and holds none of this site&apos;s keys. That is an empty store, not a blocked one — values
          appear here after your first test result or guided inspection.
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Scope: this page manages the localStorage keys DeviceTry itself writes, and nothing else. It does not clear cookies,
          IndexedDB, Cache Storage, service-worker caches, or any other origin. The cookie figure shown is only what
          <code className="mx-1">document.cookie</code> can see for this site — HttpOnly cookies are invisible to any page.
        </span>
      </div>
    </div>
  );
}

export default PrivacyStorageInspectorTester;
