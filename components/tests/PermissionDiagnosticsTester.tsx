'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle, XCircle, HelpCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import {
  PERMISSION_QUERIES,
  PermissionRow,
  hasQueryablePermissionsApi,
  runPermissionQueries,
  summarizePermissionQuery,
} from '@/lib/testing/permissionQueries';
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

const STATE_META: Record<
  PermissionRow['state'],
  { label: string; classes: string; icon: React.ReactNode; meaning: string }
> = {
  granted: {
    label: 'Granted',
    classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    icon: <CheckCircle className="w-3 h-3" aria-hidden="true" />,
    meaning: 'The browser reports this permission is currently allowed for this site.',
  },
  denied: {
    label: 'Denied',
    classes: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
    icon: <XCircle className="w-3 h-3" aria-hidden="true" />,
    meaning: 'The browser reports this permission is blocked. The feature will fail until it is re-allowed.',
  },
  prompt: {
    label: 'Prompt',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    icon: <HelpCircle className="w-3 h-3" aria-hidden="true" />,
    meaning: 'No decision has been made yet — not granted, and not blocked.',
  },
  unqueryable: {
    label: 'Not queryable',
    classes: 'bg-slate-100 text-slate-600 dark:bg-[#192332] dark:text-[#9AA6B8]',
    icon: <MinusCircle className="w-3 h-3" aria-hidden="true" />,
    meaning: 'This browser does not implement this permission name, so its state is unknown.',
  },
  error: {
    label: 'Query error',
    classes: 'bg-slate-100 text-slate-600 dark:bg-[#192332] dark:text-[#9AA6B8]',
    icon: <MinusCircle className="w-3 h-3" aria-hidden="true" />,
    meaning: 'The query itself failed, so no state was learned for this name.',
  },
};

function MinusCircle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

export function PermissionDiagnosticsTester({ onResultUpdate, onResultClear, resetSignal }: TesterProps) {
  const [rows, setRows] = useState<PermissionRow[]>(() =>
    PERMISSION_QUERIES.map((spec) => ({ ...spec, state: 'unqueryable', detail: 'not queried yet' }))
  );
  const [querying, setQuerying] = useState(false);
  const [apiSupported, setApiSupported] = useState(true);
  const [queried, setQueried] = useState(false);
  /** Guards every async continuation against reset, rerun and unmount. */
  const generationRef = useRef(0);
  /** After an explicit clear the page stays blank until the user re-queries. */
  const suppressedRef = useRef(false);

  const runQuery = useCallback(async () => {
    const generation = ++generationRef.current;
    setQuerying(true);
    const nav = navigator as Navigator & { permissions?: Permissions };

    if (!hasQueryablePermissionsApi(nav)) {
      const empty: PermissionRow[] = PERMISSION_QUERIES.map((spec) => ({
        ...spec,
        state: 'unqueryable',
        detail: 'navigator.permissions.query() is not implemented in this browser',
      }));
      if (generationRef.current !== generation) return;
      setApiSupported(false);
      setRows(empty);
      setQueried(true);
      setQuerying(false);
      const summary = summarizePermissionQuery(empty, false);
      onResultUpdate?.('unsupported', summary.details, {
        checked: 0,
        unknown: summary.counts.total,
      });
      return;
    }

    const query = (descriptor: { name: string }) =>
      nav.permissions!.query(descriptor as unknown as PermissionDescriptor) as Promise<PermissionStatus>;

    try {
      const next = await runPermissionQueries(query, PERMISSION_QUERIES);
      if (generationRef.current !== generation) return; // superseded or unmounted
      setApiSupported(true);
      setRows(next);
      setQueried(true);
      setQuerying(false);
      const summary = summarizePermissionQuery(next, true);
      onResultUpdate?.(summary.status, summary.details, {
        checked: summary.counts.checked,
        unknown: summary.counts.total - summary.counts.checked,
        denied: summary.counts.denied,
        prompt: summary.counts.prompt,
        granted: summary.counts.granted,
      });
    } catch (err) {
      if (generationRef.current !== generation) return;
      setQuerying(false);
      const message = err instanceof Error ? err.message : 'the permission query failed';
      onResultUpdate?.('inconclusive', `The permission query failed (${message}), so no permission state could be read.`);
    }
  }, [onResultUpdate]);

  useEffect(() => {
    // First query deferred to a frame callback so no setState happens
    // synchronously in the effect body; later queries come from the button.
    if (suppressedRef.current) return;
    const raf = requestAnimationFrame(() => {
      void runQuery();
    });
    return () => {
      cancelAnimationFrame(raf);
      generationRef.current += 1; // an in-flight query can no longer report
    };
  }, [runQuery]);

  const clearVisible = useCallback(() => {
    generationRef.current += 1;
    suppressedRef.current = true;
    setRows(PERMISSION_QUERIES.map((spec) => ({ ...spec, state: 'unqueryable', detail: 'not queried yet' })));
    setQueried(false);
    setQuerying(false);
    setApiSupported(true);
  }, []);

  const resetAll = useCallback(() => {
    clearVisible();
    onResultClear?.();
  }, [clearVisible, onResultClear]);

  // A host clear blanks the page and suppresses the automatic first query, so
  // a cleared result cannot be immediately repopulated without user action.
  useResetPulse(resetSignal, clearVisible);

  const reQuery = useCallback(() => {
    suppressedRef.current = false;
    void runQuery();
  }, [runQuery]);

  const summary = queried ? summarizePermissionQuery(rows, apiSupported) : null;
  const learned = summary ? summary.counts.checked : 0;
  const unknown = summary ? summary.counts.total - summary.counts.checked : rows.length;

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Permission Status Diagnostics</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              Read-only state queries — this page never triggers a prompt and never requests access
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            title="Reset permission result"
            aria-label="Reset permission result"
            className="px-3 py-2 rounded-lg border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset
          </button>
          <button
            onClick={reQuery}
            disabled={querying || !apiSupported}
            className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${querying ? 'animate-spin' : ''}`} aria-hidden="true" />
            {querying ? 'Querying…' : 'Re-query states'}
          </button>
        </div>
      </div>

      {!queried && <p className="mt-4 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Reading permission states…</p>}

      {queried && !apiSupported && (
        <div className="mt-4 p-6 rounded-lg bg-slate-50 dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
          <XCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">
            Permissions API unavailable — this is not a pass
          </p>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
            navigator.permissions.query() does not exist in this browser, so no permission state was read. Coverage differs by
            engine: Chromium-based browsers implement the widest set, Firefox supports a subset of the names, and Safari
            exposes very few. Check a tool&apos;s own prompt instead — the outcome of that prompt is the real state.
          </p>
        </div>
      )}

      {queried && (
        <>
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#0F766E] dark:text-[#14B8A6]" aria-hidden="true" />
            <span>
              Read {learned} of {rows.length} permission name{rows.length === 1 ? '' : 's'}
              {unknown > 0 ? `; ${unknown} remain unknown (not implemented here, or the query failed)` : ' — full coverage'}.
              A reported state is a browser bookkeeping value: &quot;granted&quot; means access is permitted, not that a
              microphone or camera actually delivers sound or video.
            </span>
          </div>

          <ScrollableTable label="Permission state results" className="mt-4" minWidthClass="min-w-[560px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F9] dark:bg-[#192332]">
                <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
                  <th scope="col" className="py-2.5 px-4 font-semibold">Permission</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold w-36">Reported state</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold">What that means</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                {rows.map((row) => {
                  const meta = STATE_META[row.state];
                  return (
                    <tr key={row.name} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                      <td className="py-2.5 px-4 font-medium text-[#142033] dark:text-[#E9EEF4]">
                        {row.label}
                        <span className="block font-mono-num text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">{row.name}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${meta.classes}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#5F6B7A] dark:text-[#9AA6B8]">
                        {meta.meaning}
                        {row.detail && row.state !== 'granted' && row.state !== 'prompt' && row.state !== 'denied' && (
                          <span className="block text-[10px] opacity-80 break-words">{row.detail}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableTable>
        </>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        <strong>Denied something?</strong> The control lives in your browser, not in this page. Chromium browsers: click the
        lock/tune icon left of the address bar, find the permission, set it to Allow, then re-query. Firefox: the permissions
        panel is the padlock (or ⋮ → Permissions) — remove the block for this site. Safari: use the &ldquo;aA&rdquo; menu →
        Website Settings → Microphone/Camera, then reload. Because iOS Safari exposes very few permission names here, a
        missing row on iPhone or iPad says nothing about the actual state — decide it in the tool&apos;s own prompt. Reload this
        page after any change; permission states are only re-read when you ask.
      </div>
    </div>
  );
}

export default PermissionDiagnosticsTester;
