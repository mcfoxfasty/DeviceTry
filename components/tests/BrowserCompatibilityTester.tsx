'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ListChecks, Search, CheckCircle, XCircle, MinusCircle, PowerOff, AlertTriangle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_CHECKS,
  CapabilityRow,
  CapabilityState,
  countCapabilities,
  evaluateCapabilities,
  filterCapabilities,
  summarizeCapabilities,
} from '@/lib/testing/browserCapabilities';
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

/**
 * One-shot capability store used via useSyncExternalStore.
 *
 * Hydration contract: getServerSnapshot returns null, so the server HTML and
 * the first client render both show the stable "Checking…" state. Detection
 * starts only from `subscribe` (after hydration, via queueMicrotask), computes
 * every probe EXACTLY ONCE, caches the result array, and notifies subscribers
 * once. Typing in the search box never re-runs a probe, and no probe runs
 * during render or synchronously inside an effect body.
 */
let detectedCache: CapabilityRow[] | null = null;
let detectionStarted = false;
const detectListeners = new Set<() => void>();

function startDetectionOnce(): void {
  if (detectionStarted) return;
  detectionStarted = true;
  detectedCache = evaluateCapabilities(CAPABILITY_CHECKS);
  for (const notify of detectListeners) notify();
}

function subscribeCapabilities(onStoreChange: () => void): () => void {
  detectListeners.add(onStoreChange);
  queueMicrotask(startDetectionOnce);
  return () => {
    detectListeners.delete(onStoreChange);
  };
}

const getDetectedSnapshot = (): CapabilityRow[] | null => detectedCache;
const getServerSnapshot = (): null => null;

/**
 * Re-runs every probe and swaps in a fresh result array, for the explicit
 * "Re-check" action. The module-level one-shot flag is reset first, otherwise
 * `startDetectionOnce()` would short-circuit and the user would be shown the
 * identical cached rows as if something had been re-measured.
 */
function redetectCapabilities(): void {
  detectionStarted = false;
  detectedCache = null;
  startDetectionOnce();
}

const STATE_META: Record<
  CapabilityState,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  available: {
    label: 'Available',
    classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    icon: <CheckCircle className="w-3 h-3" aria-hidden="true" />,
  },
  disabled: {
    label: 'Exposed, off',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    icon: <PowerOff className="w-3 h-3" aria-hidden="true" />,
  },
  missing: {
    label: 'Missing',
    classes: 'bg-slate-100 text-slate-600 dark:bg-[#192332] dark:text-[#9AA6B8]',
    icon: <XCircle className="w-3 h-3" aria-hidden="true" />,
  },
  error: {
    label: 'Probe error',
    classes: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
    icon: <MinusCircle className="w-3 h-3" aria-hidden="true" />,
  },
};

export function BrowserCompatibilityTester({ onResultUpdate, onResultClear, resetSignal }: TesterProps) {
  const [filter, setFilter] = useState<string>('All');
  const [query, setQuery] = useState<string>('');

  const rows = useSyncExternalStore(subscribeCapabilities, getDetectedSnapshot, getServerSnapshot);
  const visible = useMemo(() => (rows ? filterCapabilities(rows, { query, category: filter }) : []), [rows, query, filter]);
  const counts = useMemo(() => (rows ? countCapabilities(rows) : null), [rows]);

  /**
   * Report the read once per detection pass. This card has no Start button —
   * the matrix is produced by passive probes — so without this the shared
   * banner (and with it export, local history and report building) would never
   * appear at all for this tool. Guarded by a ref so re-renders and typing in
   * the search box cannot re-emit the same reading.
   */
  const emittedRef = useRef(false);
  useEffect(() => {
    if (!counts || emittedRef.current) return;
    emittedRef.current = true;
    const summary = summarizeCapabilities(counts);
    onResultUpdate?.(summary.status, summary.details, summary.metrics);
  }, [counts, onResultUpdate]);

  const recheck = useCallback(() => {
    // Re-arm the emission guard so the fresh read is reported, not the old one.
    emittedRef.current = false;
    redetectCapabilities();
  }, []);

  const resetAll = () => {
    setQuery('');
    setFilter('All');
    onResultClear?.();
  };

  // A host clear also drops the search text and category filter, so nothing on
  // the card is left describing a filter the user has discarded. The matrix
  // itself survives: it describes this browser, not a run the user cancelled,
  // and "Re-check" restores the verdict afterwards.
  useResetPulse(resetSignal, () => {
    setQuery('');
    setFilter('All');
  });

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <ListChecks className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Browser Capability Matrix</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              Passive read-only probes — no permission is requested and no request leaves the page
            </p>
          </div>
        </div>
        <div className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]" role="status">
          {counts ? (
            <>
              <span className="text-emerald-600 dark:text-emerald-400">{counts.available}</span> available ·{' '}
              <span className="text-amber-600 dark:text-amber-400">{counts.disabled}</span> off · {counts.missing} missing
              {counts.error > 0 ? ` · ${counts.error} probe error${counts.error === 1 ? '' : 's'}` : ''}
            </>
          ) : (
            <span>Detecting…</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <label htmlFor="capability-search" className="sr-only">
            Search the capability matrix by API name, category, or property read
          </label>
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="capability-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search APIs…"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-xs text-[#142033] dark:text-[#E9EEF4] focus:outline-none focus:border-[#0F766E]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter capabilities by category">
          {CAPABILITY_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              aria-pressed={filter === category}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                filter === category
                  ? 'bg-[#0F766E] text-white'
                  : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        {(query !== '' || filter !== 'All') && (
          <button
            type="button"
            onClick={resetAll}
            className="self-start px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] cursor-pointer hover:border-[#0F766E]"
          >
            Clear filters
          </button>
        )}
        {/* Probes are re-run on demand rather than on load: the matrix above is
            a snapshot, and a browser can gain a capability (an extension, a
            newly enabled setting) without the page being reloaded. */}
        <button
          type="button"
          onClick={recheck}
          className="self-start px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] cursor-pointer hover:border-[#0F766E]"
        >
          Re-check capabilities
        </button>
      </div>

      <ScrollableTable label="Browser API capability results" maxHeight="max-h-[460px]" className="mt-4" minWidthClass="min-w-[720px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F7F9] dark:bg-[#192332] sticky top-0">
            <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
              <th scope="col" className="py-2.5 px-4 font-semibold">Web API</th>
              <th scope="col" className="py-2.5 px-4 font-semibold w-24">Category</th>
              <th scope="col" className="py-2.5 px-4 font-semibold w-32">State</th>
              <th scope="col" className="py-2.5 px-4 font-semibold">What was read</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
            {visible.map((row) => {
              const meta = STATE_META[row.state];
              return (
                <tr key={row.name} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                  <td className="py-2 px-4 text-[#142033] dark:text-[#E9EEF4] font-medium">{row.name}</td>
                  <td className="py-2 px-4 text-[#5F6B7A] dark:text-[#9AA6B8]">{row.category}</td>
                  <td className="py-2 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${meta.classes}`}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-[#5F6B7A] dark:text-[#9AA6B8] break-words">
                    <span className="font-mono-num text-[10px]">{row.reads}</span>
                    <span className="block text-[10px] opacity-90">{row.detail}</span>
                  </td>
                </tr>
              );
            })}
            {rows && visible.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#5F6B7A] dark:text-[#9AA6B8]">
                  <MinusCircle className="w-6 h-6 mx-auto mb-1 opacity-40" aria-hidden="true" />
                  No APIs match &quot;{query}&quot; in {filter === 'All' ? 'any category' : filter}
                </td>
              </tr>
            )}
            {!rows &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td colSpan={4} className="py-3 px-4">
                    <span className="block h-3 rounded bg-[#DFE5EB] dark:bg-[#223043]" />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </ScrollableTable>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8] flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#0F766E] dark:text-[#14B8A6]" aria-hidden="true" />
        <span>
          <strong>&ldquo;Available&rdquo;</strong> means the API is present and usable &mdash; the function exists, or the context
          was created, or the value is affirmative. <strong>&ldquo;Exposed, off&rdquo;</strong> means the browser ships it but
          reports it switched off, which is a different situation from missing. None of these rows requests a permission or
          captures anything, and none of them proves a piece of hardware works.
        </span>
      </div>
    </div>
  );
}

export default BrowserCompatibilityTester;
