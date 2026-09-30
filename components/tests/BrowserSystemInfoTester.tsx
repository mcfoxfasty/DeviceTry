'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Cpu, MonitorSmartphone, RotateCcw, Info } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import {
  SystemSnapshot,
  collectScreenFacts,
  collectSystemSnapshot,
  summarizeSystemSnapshot,
} from '@/lib/testing/systemInfoFacts';
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

export function BrowserSystemInfoTester({ onResultUpdate, onResultClear, resetSignal }: TesterProps) {
  const [info, setInfo] = useState<SystemSnapshot | null>(null);
  /** Guards the deferred collection against unmount. */
  const generationRef = useRef(0);
  /**
   * After an explicit clear the table stays blank until Re-read is pressed.
   * State, not a ref: the placeholder below renders this fact, and a ref read
   * during render is not guaranteed to have re-rendered with it.
   */
  const [suppressed, setSuppressed] = useState(false);
  /**
   * Mirror of `suppressed` for the mount effect below, which must read the
   * latest committed value without being re-created (and re-run) every time it
   * flips — Re-read collects on its own, and a dependency would collect twice.
   * Declared first, so this mirror is always applied before the guard reads it.
   */
  const suppressedRef = useRef(false);
  useEffect(() => {
    suppressedRef.current = suppressed;
  }, [suppressed]);

  const collect = useCallback(() => {
    const generation = ++generationRef.current;
    const screenFacts = collectScreenFacts({
      screen: window.screen,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
    const snapshot = collectSystemSnapshot({ navigator: window.navigator, screen: screenFacts });
    if (generationRef.current !== generation) return;
    setInfo(snapshot);
    const summary = summarizeSystemSnapshot(snapshot);
    // An informational snapshot is 'measured' — it reports values and cannot
    // pass or fail any hardware.
    onResultUpdate?.(summary.status, summary.details, summary.metrics);
  }, [onResultUpdate]);

  useEffect(() => {
    if (suppressedRef.current) return;
    // Adopt the snapshot one frame later (outside the effect body): the state
    // update happens in a callback, not synchronously during the effect.
    const raf = requestAnimationFrame(collect);
    return () => {
      cancelAnimationFrame(raf);
      generationRef.current += 1;
    };
  }, [collect]);

  // A host clear blanks the table: the snapshot stays hidden until the user
  // asks for a new reading, so a cleared banner cannot reappear immediately.
  useResetPulse(resetSignal, () => {
    generationRef.current += 1;
    setSuppressed(true);
    setInfo(null);
  });

  const resetAll = () => {
    generationRef.current += 1;
    setSuppressed(true);
    setInfo(null);
    onResultClear?.();
  };

  const reRead = () => {
    setSuppressed(false);
    requestAnimationFrame(collect);
  };

  if (!info) {
    return (
      <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
        <div className="p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          {suppressed
            ? 'Snapshot cleared. Press Re-read to read this browser again.'
            : 'Reading navigator and window properties…'}
        </div>
      </div>
    );
  }

  const rows: { label: string; value: string; note?: string }[] = [
    { label: 'User-agent string', value: 'shown in full below', note: 'Raw value — any extension can rewrite it.' },
    { label: 'Browser engine', value: info.uaFacts.engine, note: 'Estimated from the user-agent string, not verified.' },
    { label: 'Operating system', value: info.uaFacts.os, note: `${info.uaFacts.osConfidence}.` },
    { label: 'Architecture', value: info.uaFacts.architecture, note: 'Estimated from the user agent; never a verified CPU model.' },
    { label: 'Logical CPU cores', value: info.hardwareConcurrency },
    { label: 'Device memory', value: info.deviceMemory },
    { label: 'Platform string', value: info.platform, note: 'A legacy, frozen string — Win32 is reported even on 64-bit Windows.' },
    { label: 'Vendor', value: info.vendor },
    { label: 'Language(s)', value: `${info.language}${info.languages !== info.language ? ` (${info.languages})` : ''}` },
    { label: 'Max touch points', value: info.maxTouchPoints, note: '0 is a real reading: no touch digitizer is exposed.' },
    { label: 'Cookies', value: info.cookieEnabled },
    { label: 'Connection status', value: info.onLine },
    { label: 'Network type', value: info.connection },
    { label: 'Downlink estimate', value: info.downlink },
    { label: 'Screen area (screen.width × screen.height)', value: `${info.screenFacts.screenWidth} × ${info.screenFacts.screenHeight}` },
    { label: 'Screen usable area (excludes taskbar/dock)', value: `${info.screenFacts.availWidth} × ${info.screenFacts.availHeight}` },
    { label: 'Colour depth', value: info.screenFacts.colorDepth },
    { label: 'Viewport right now (window.innerWidth × innerHeight)', value: `${info.screenFacts.viewportWidth} × ${info.screenFacts.viewportHeight}`, note: 'Changes as you resize this window.' },
    { label: 'Device pixel ratio', value: info.screenFacts.devicePixelRatio },
  ];

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Globe className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Browser &amp; System Information</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              An informational snapshot of what this browser exposes — it tests nothing
            </p>
          </div>
        </div>
        <button
          onClick={reRead}
          title="Re-read the snapshot"
          aria-label="Re-read the snapshot"
          className="px-3 py-2 rounded-lg border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />          Re-read
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center gap-3">
          <Globe className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">
              Engine (estimated)
            </p>
            <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] break-words">{info.uaFacts.engine}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center gap-3">
          <MonitorSmartphone className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">
              OS ({info.uaFacts.osConfidence === 'ambiguous' ? 'ambiguous' : 'estimated'})
            </p>
            <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] break-words">{info.uaFacts.os}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center gap-3">
          <Cpu className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Viewport</p>
            <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] break-words font-mono-num">
              {info.screenFacts.viewportWidth} × {info.screenFacts.viewportHeight}
            </p>
          </div>
        </div>
      </div>

      {info.uaFacts.note && (
        <p className="mt-3 text-[11px] leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8] break-words">
          <strong>Reading caveat:</strong> {info.uaFacts.note}
        </p>
      )}

      <ScrollableTable label="Browser and system information" className="mt-4" minWidthClass="min-w-[560px]">
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                <th scope="row" className="py-2.5 px-4 font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] w-64 align-top">
                  {row.label}
                </th>
                <td className="py-2.5 px-4 font-mono-num text-[#142033] dark:text-[#E9EEF4] break-all">
                  {row.value}
                  {row.note && <span className="block font-sans text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">{row.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-semibold text-[#0F766E] dark:text-[#14B8A6]">
          Show full User-Agent string
        </summary>
        <p className="mt-2 p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] font-mono-num text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] break-all">
          {info.userAgent}
        </p>
      </details>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8] flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#0F766E] dark:text-[#14B8A6]" aria-hidden="true" />
        <span>
          {info.screenFacts.note} Engine, OS and architecture rows are parsed from the user-agent string and are labelled as
          estimates; a spoofing extension can change every one of them. Device memory is deliberately bucketed and CPU cores
          are capped. Nothing here is a health check — this page reports what the browser chooses to expose, and no
          confidential hardware serial is queried.
        </span>
      </div>
    </div>
  );
}

export default BrowserSystemInfoTester;
