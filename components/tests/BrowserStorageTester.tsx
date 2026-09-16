'use client';

import React, { useState } from 'react';
import { Database, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface StorageReport {
  quotaBytes: number | null;
  usageBytes: number | null;
  persisted: boolean | null;
  localStorageAvailable: boolean;
  localStorageKeys: number;
  indexedDbAvailable: boolean;
  idbTest: 'idle' | 'running' | 'passed' | 'failed';
  idbDetail: string;
}

const TEST_DB = 'devicetry_storage_test';
const TEST_STORE = 'probe';

function formatBytes(bytes: number | null): string {
  if (bytes === null || !isFinite(bytes)) return 'Unknown';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function BrowserStorageTester({ onResultUpdate }: TesterProps) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [running, setRunning] = useState<boolean>(false);

  const localStorageAvailable = (() => {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
      return false;
    }
  })();

  const runDiagnostics = async () => {
    setRunning(true);
    const nav = navigator as Navigator & { storage?: StorageManager };
    const storage = nav.storage;

    let quotaBytes: number | null = null;
    let usageBytes: number | null = null;
    let persisted: boolean | null = null;

    if (storage && typeof storage.estimate === 'function') {
      try {
        const est = await storage.estimate();
        quotaBytes = est.quota ?? null;
        usageBytes = est.usage ?? null;
      } catch {
        /* ignore */
      }
    }
    if (storage && typeof storage.persisted === 'function') {
      try {
        persisted = await storage.persisted();
      } catch {
        persisted = null;
      }
    }

    const report: StorageReport = {
      quotaBytes,
      usageBytes,
      persisted,
      localStorageAvailable,
      localStorageKeys: localStorageAvailable ? window.localStorage.length : 0,
      indexedDbAvailable: typeof indexedDB !== 'undefined',
      idbTest: 'running',
      idbDetail: 'Running read/write/delete probe…',
    };
    setReport(report);

    // Non-destructive IndexedDB round trip: open → put → get → delete → close
    if (report.indexedDbAvailable) {
      try {
        const result = await new Promise<string>((resolve, reject) => {
          const req = indexedDB.open(TEST_DB, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(TEST_STORE)) db.createObjectStore(TEST_STORE);
          };
          req.onerror = () => reject(req.error ?? new Error('open failed'));
          req.onsuccess = () => {
            const db = req.result;
            try {
              const tx = db.transaction(TEST_STORE, 'readwrite');
              const store = tx.objectStore(TEST_STORE);
              const payload = { probe: 'devicetry', ts: Date.now() };
              store.put(payload, 'probe-key');
              tx.oncomplete = () => {
                const readTx = db.transaction(TEST_STORE, 'readonly');
                const getReq = readTx.objectStore(TEST_STORE).getAllKeys();
                getReq.onsuccess = () => {
                  const found = (getReq.result as string[]).includes('probe-key');
                  const delTx = db.transaction(TEST_STORE, 'readwrite');
                  delTx.objectStore(TEST_STORE).delete('probe-key');
                  delTx.oncomplete = () => {
                    db.close();
                    indexedDB.deleteDatabase(TEST_DB);
                    resolve(found ? 'Write, read and delete verified successfully.' : 'Key not found after write.');
                  };
                  delTx.onerror = () => {
                    db.close();
                    reject(delTx.error ?? new Error('delete failed'));
                  };
                };
                getReq.onerror = () => {
                  db.close();
                  reject(getReq.error ?? new Error('read failed'));
                };
              };
              tx.onerror = () => {
                db.close();
                reject(tx.error ?? new Error('write failed'));
              };
            } catch (e) {
              db.close();
              reject(e as Error);
            }
          };
        });

        const updated: StorageReport = { ...report, idbTest: 'passed', idbDetail: result };
        setReport(updated);
        onResultUpdate?.('passed', `Storage OK — quota ${formatBytes(quotaBytes)}, IndexedDB round-trip passed`);
      } catch (err) {
        const updated: StorageReport = {
          ...report,
          idbTest: 'failed',
          idbDetail: `IndexedDB probe failed: ${(err as Error).message}`,
        };
        setReport(updated);
        onResultUpdate?.('failed', 'IndexedDB round-trip failed');
      }
    } else {
      setReport({ ...report, idbTest: 'failed', idbDetail: 'IndexedDB is not available (private mode or blocked site data).' });
      onResultUpdate?.('warning', 'IndexedDB unavailable');
    }
    setRunning(false);
  };

  const rows = report
    ? [
        { label: 'Estimated Quota', value: formatBytes(report.quotaBytes) },
        { label: 'Currently Used', value: formatBytes(report.usageBytes) },
        {
          label: 'Usage Share',
          value:
            report.quotaBytes && report.usageBytes !== null
              ? `${((report.usageBytes / report.quotaBytes) * 100).toFixed(3)}%`
              : 'Unknown',
        },
        { label: 'Persistent Storage', value: report.persisted === null ? 'Not granted' : report.persisted ? 'Granted' : 'Best-effort' },
        { label: 'localStorage', value: report.localStorageAvailable ? `Available (${report.localStorageKeys} keys)` : 'Blocked' },
        { label: 'IndexedDB', value: report.indexedDbAvailable ? 'Available' : 'Unavailable' },
      ]
    : [];

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Browser Storage &amp; Quota Test</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Non-destructive origin storage diagnostics</p>
          </div>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Running…' : 'Run Storage Diagnostics'}
        </button>
      </div>

      {report ? (
        <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rows.map((row) => (
              <div key={row.label} className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">{row.label}</p>
                <p className="font-mono-num text-sm font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">{row.value}</p>
              </div>
            ))}
          </div>

          <div
            className={`mt-4 p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
              report.idbTest === 'passed'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : report.idbTest === 'failed'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {report.idbTest === 'passed' ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : report.idbTest === 'failed' ? (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
            )}
            <span>
              <strong>IndexedDB probe:</strong> {report.idbDetail}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          Press Run Storage Diagnostics to query your origin quota and verify IndexedDB read/write/delete.
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        Quota reflects the partition the browser allots to this origin — not free disk space. Private browsing assigns temporary restricted quotas. The probe database is deleted afterwards.
      </div>
    </div>
  );
}
