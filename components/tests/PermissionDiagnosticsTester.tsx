'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

interface PermRow {
  name: string;
  label: string;
  state: PermState;
}

const QUERIES: { name: string; label: string }[] = [
  { name: 'microphone', label: 'Microphone' },
  { name: 'camera', label: 'Camera' },
  { name: 'clipboard-read', label: 'Clipboard Read' },
  { name: 'clipboard-write', label: 'Clipboard Write' },
  { name: 'notifications', label: 'Notifications' },
  { name: 'geolocation', label: 'Geolocation' },
  { name: 'persistent-storage', label: 'Persistent Storage' },
  { name: 'midi', label: 'MIDI Access' },
];

const STATE_META: Record<PermState, { label: string; classes: string; icon: React.ReactNode }> = {
  granted: {
    label: 'Granted',
    classes: 'bg-emerald-100 text-emerald-800',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  denied: {
    label: 'Denied',
    classes: 'bg-red-100 text-red-800',
    icon: <XCircle className="w-3 h-3" />,
  },
  prompt: {
    label: 'Prompt',
    classes: 'bg-amber-100 text-amber-800',
    icon: <HelpCircle className="w-3 h-3" />,
  },
  unsupported: {
    label: 'Not Queryable',
    classes: 'bg-slate-100 text-slate-600',
    icon: <MinusCircle className="w-3 h-3" />,
  },
  unknown: {
    label: 'Unknown',
    classes: 'bg-slate-100 text-slate-600',
    icon: <MinusCircle className="w-3 h-3" />,
  },
};

function MinusCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

export function PermissionDiagnosticsTester({ onResultUpdate }: TesterProps) {
  const [rows, setRows] = useState<PermRow[]>(() => QUERIES.map((q) => ({ ...q, state: 'unknown' as PermState })));
  const [querying, setQuerying] = useState<boolean>(false);
  const [apiSupported, setApiSupported] = useState<boolean>(true);

  const runQuery = useCallback(async () => {
    setQuerying(true);
    const nav = navigator as Navigator & { permissions?: Permissions };
    if (!nav.permissions || typeof nav.permissions.query !== 'function') {
      setApiSupported(false);
      setQuerying(false);
      onResultUpdate?.('unsupported', 'navigator.permissions.query() is not available in this browser');
      return;
    }

    const next: PermRow[] = [];
    for (const q of QUERIES) {
      try {
        const status = await nav.permissions.query({ name: q.name as PermissionName });
        next.push({ ...q, state: status.state as PermState });
      } catch {
        next.push({ ...q, state: 'unsupported' });
      }
    }
    setRows(next);
    setQuerying(false);

    const denied = next.filter((r) => r.state === 'denied').map((r) => r.label);
    onResultUpdate?.(
      denied.length > 0 ? 'warning' : 'passed',
      denied.length > 0 ? `Blocked permissions: ${denied.join(', ')}` : 'No blocked permissions detected'
    );
  }, [onResultUpdate]);

  useEffect(() => {
    runQuery();
  }, [runQuery]);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Permission Status Diagnostics</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Read-only permission state query — never triggers prompts</p>
          </div>
        </div>
        <button
          onClick={runQuery}
          disabled={querying || !apiSupported}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${querying ? 'animate-spin' : ''}`} />
          {querying ? 'Querying…' : 'Refresh Status'}
        </button>
      </div>

      {!apiSupported ? (
        <div className="mt-5 p-6 rounded-lg bg-slate-50 dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
          <XCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">Permissions API unavailable</p>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
            This browser does not expose navigator.permissions.query(). Firefox supports a subset; older engines none.
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F9] dark:bg-[#192332]">
              <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
                <th className="py-2.5 px-4 font-semibold">Permission</th>
                <th className="py-2.5 px-4 font-semibold w-36">Current State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
              {rows.map((row) => {
                const meta = STATE_META[row.state];
                return (
                  <tr key={row.name} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                    <td className="py-2.5 px-4 font-medium text-[#142033] dark:text-[#E9EEF4]">{row.label}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${meta.classes}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        <strong>Denied a permission?</strong> Click the lock / tune icon at the left of your address bar, switch the setting from Block to Allow, then press Refresh Status.
      </div>
    </div>
  );
}
