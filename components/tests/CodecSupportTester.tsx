'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Film, Play, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import {
  CodecResult,
  CodecRow,
  PLAYBACK_SPECS,
  RECORDING_SPECS,
  probeCodecSupport,
  summarizeCodecProbe,
} from '@/lib/testing/codecProbe';
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

const RESULT_META: Record<CodecResult, { label: string; classes: string; meaning: string }> = {
  supported: {
    label: 'Supported',
    classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    meaning: 'the browser reports this format as supported',
  },
  maybe: {
    label: 'Maybe',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    meaning: 'the browser cannot confirm — uncertain, not a negative',
  },
  unsupported: {
    label: 'Reported missing',
    classes: 'bg-slate-100 text-slate-600 dark:bg-[#192332] dark:text-[#9AA6B8]',
    meaning: 'the API answered, and the answer was negative',
  },
  unavailable: {
    label: 'API unavailable',
    classes: 'bg-slate-100 text-slate-600 dark:bg-[#192332] dark:text-[#9AA6B8]',
    meaning: 'the API that answers this question does not exist here',
  },
  error: {
    label: 'Probe error',
    classes: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
    meaning: 'the probe itself threw, so nothing was learned',
  },
};

export function CodecSupportTester({ onResultUpdate, onResultClear, resetSignal }: TesterProps) {
  const [rows, setRows] = useState<CodecRow[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const generationRef = useRef(0);

  const probe = useCallback(() => {
    const generation = ++generationRef.current;
    // Two elements, each bound to the kind of row it answers: an audio/* mime
    // string is never handed to a <video> element (and vice versa).
    const report = probeCodecSupport({
      recorder: typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined,
      videoElement: typeof document !== 'undefined' ? document.createElement('video') : null,
      audioElement: typeof document !== 'undefined' ? document.createElement('audio') : null,
    });
    if (generationRef.current !== generation) return;
    setRows(report.rows);
    const verdict = summarizeCodecProbe(report);
    setSummary(verdict.details);
    // Never "passed": these are capability statements from the browser's own
    // tables, not observations of a recording, a decode, or a call.
    onResultUpdate?.(verdict.status, verdict.details, verdict.metrics);
  }, [onResultUpdate]);

  const resetAll = useCallback(() => {
    generationRef.current += 1;
    setRows(null);
    setSummary(null);
    onResultClear?.();
  }, [onResultClear]);

  const positives = rows?.filter((row) => row.result === 'supported').length ?? 0;

  // A host clear empties the capability table as well as the banner.
  useResetPulse(resetSignal, () => {
    generationRef.current += 1;
    setRows(null);
    setSummary(null);
  });

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Film className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Codec &amp; Container Capability Report</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              What the browser reports about {RECORDING_SPECS.length + PLAYBACK_SPECS.length} recording and playback formats
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            disabled={rows === null}
            title="Reset codec result"
            aria-label="Reset codec result"
            className="px-3 py-2 rounded-lg border border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset
          </button>
          <button
            onClick={probe}
            className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" /> Run capability probe
          </button>
        </div>
      </div>

      {rows ? (
        <>
          <div className="mt-4 p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] text-[11px] leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
            <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
              Probe completed — {positives} of {rows.length} formats reported supported.
            </p>
            <p className="mt-1">{summary}</p>
          </div>

          <ScrollableTable label="Codec capability results" maxHeight="max-h-[420px]" className="mt-4" minWidthClass="min-w-[640px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F9] dark:bg-[#192332] sticky top-0">
                <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
                  <th scope="col" className="py-2.5 px-4 font-semibold">Format</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold w-24">Kind</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold w-32">Reported</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold w-20">Raw answer</th>
                  <th scope="col" className="py-2.5 px-4 font-semibold hidden md:table-cell">How this was read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                {rows.map((row) => {
                  const meta = RESULT_META[row.result];
                  return (
                    <tr key={`${row.kind}-${row.mime}`} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                      <td className="py-2 px-4">
                        <p className="font-medium text-[#142033] dark:text-[#E9EEF4]">{row.name}</p>
                        <p className="font-mono-num text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5 break-all">{row.mime}</p>
                      </td>
                      <td className="py-2 px-4 text-[#5F6B7A] dark:text-[#9AA6B8] capitalize">{row.kind}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${meta.classes}`}
                          title={meta.meaning}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono-num text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">{row.raw}</td>
                      <td className="py-2 px-4 text-[#5F6B7A] dark:text-[#9AA6B8] hidden md:table-cell">{row.method}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableTable>
        </>
      ) : (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          Press Run capability probe to ask this browser what it reports for each recording and playback format.
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
        <p>
          Recording rows come from <code>MediaRecorder.isTypeSupported()</code>; playback rows come from
          <code> canPlayType()</code> on a matching media element. Both are capability answers from the browser&apos;s own
          tables: nothing is recorded, decoded, accelerated or negotiated here, and no row predicts call quality.
        </p>
        <p className="mt-1">
          A missing optional format is not a fault — browser builds ship different codec sets. The Voice Recorder on this site
          is unaffected: it captures PCM and encodes a genuine WAV itself, so its downloads are <code>.wav</code> on every
          engine.
        </p>
      </div>
    </div>
  );
}

export default CodecSupportTester;
