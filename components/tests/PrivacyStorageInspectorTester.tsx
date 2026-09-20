'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Trash2, Download, FileText, AlertTriangle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { getLocalInspections, clearAllLocalInspections, LocalInspectionItem } from '@/lib/testing/localHistory';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface StorageKeyInfo {
  key: string;
  sizeBytes: number;
}

export function PrivacyStorageInspectorTester({ onResultUpdate }: TesterProps) {
  const [keys, setKeys] = useState<StorageKeyInfo[]>([]);
  const [inspections, setInspections] = useState<LocalInspectionItem[]>([]);
  const [cookieCount, setCookieCount] = useState<number>(0);

  const refresh = useCallback(() => {
    const list: StorageKeyInfo[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key === null) continue;
        const value = window.localStorage.getItem(key) || '';
        list.push({ key, sizeBytes: new Blob([value]).size });
      }
    } catch {
      /* storage blocked */
    }
    setKeys(list);
    setInspections(getLocalInspections());
    setCookieCount(document.cookie ? document.cookie.split(';').length : 0);
  }, []);

  useEffect(() => {
    // Initial refresh deferred to a frame callback so no setState happens
    // synchronously in the effect body; later refreshes come from clearAll.
    const raf = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(raf);
  }, [refresh]);

  const exportBackup = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), inspections }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devicetry-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (!confirm('Clear ALL DeviceTry data stored in this browser? This includes your local inspection history and preferences.')) return;
    clearAllLocalInspections();
    // Remove all devicetry-prefixed keys (language cookie / theme flags)
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && /devicetry/i.test(key)) toRemove.push(key);
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    refresh();
    onResultUpdate?.('passed', 'All DeviceTry local data cleared');
  };

  const totalBytes = keys.reduce((sum, k) => sum + k.sizeBytes, 0);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">DeviceTry Privacy &amp; Data Inspector</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Everything this app stores in your browser — view, export or wipe</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inspections.length > 0 && (
            <button
              onClick={exportBackup}
              className="px-3 py-2 rounded-lg bg-white dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] text-[#142033] dark:text-[#E9EEF4] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Backup
            </button>
          )}
          <button
            onClick={clearAll}
            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All Data
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Stored Records</p>
          <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">{inspections.length} inspections</p>
        </div>
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">localStorage Keys</p>
          <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">{keys.length} keys • {totalBytes < 1024 ? `${totalBytes} B` : `${(totalBytes / 1024).toFixed(1)} KB`}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">First-party Cookies</p>
          <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mt-1">{cookieCount} cookie{cookieCount === 1 ? '' : 's'}</p>
        </div>
      </div>

      {inspections.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] mb-2">Local Inspection Records</p>
          <div className="space-y-2">
            {inspections.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6] shrink-0" />
                  <span className="font-medium text-[#142033] dark:text-[#E9EEF4] truncate">{item.deviceLabel}</span>
                  <span className="text-[#5F6B7A] dark:text-[#9AA6B8] shrink-0">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                  item.summaryStatus === 'passed' ? 'bg-emerald-100 text-emerald-800' : item.summaryStatus === 'warning' ? 'bg-amber-100 text-amber-800' : item.summaryStatus === 'failed' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {item.summaryStatus}
                </span>
              </div>
            ))}
            {inspections.length > 6 && (
              <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">…and {inspections.length - 6} more records</p>
            )}
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] mb-2">localStorage Contents</p>
          <div className="rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                {keys.map((k) => (
                  <tr key={k.key} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                    <td className="py-2 px-4 font-mono-num text-[#142033] dark:text-[#E9EEF4]">{k.key}</td>
                    <td className="py-2 px-4 text-right font-mono-num text-[#5F6B7A] dark:text-[#9AA6B8]">{k.sizeBytes} B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {keys.length === 0 && inspections.length === 0 && (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Your browser stores no DeviceTry data yet. Records appear here after your first guided inspection.
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        This inspector manages exclusively this DeviceTry origin — it cannot read data from other websites. Clearing resets inspection history and language preferences.
      </div>
    </div>
  );
}
