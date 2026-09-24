'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gauge, Play, Square, RotateCcw, AlertCircle, Info } from 'lucide-react';
import {
  CloudflareSpeedTestController,
  SpeedSummary,
  SpeedPhase,
} from '@/lib/testing/speedProvider';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';

interface InternetSpeedTesterProps {
  /** Host telemetry sink — also feeds the shared banner (history + safe share). */
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  /** Host hook notified when the user clears/resets this tester's result. */
  onResultClear?: () => void;
  /** Forwarded to the banner to enable privacy-safe share + local history. */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
}

interface SpeedState {
  phase: SpeedPhase;
  error?: string;
}

const EMPTY_SUMMARY: SpeedSummary = {
  downloadMbps: null,
  uploadMbps: null,
  latencyMs: null,
  jitterMs: null,
  downLoadedLatencyMs: null,
  upLoadedLatencyMs: null,
};

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8996A6]">{label}</p>
      <p className="mt-1 text-2xl font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4]">
        {value === null ? '—' : value.toLocaleString('en-US')}
        <span className="text-xs font-semibold text-[#59677D] dark:text-[#9AA6B8] ml-1.5">{unit}</span>
      </p>
    </div>
  );
}

/**
 * Internet Speed Test (Phase 9, item H). Real measurements through the
 * provider adapter (lib/testing/speedProvider.ts); the UI never fabricates a
 * value — unavailable metrics render as "—". No test starts automatically.
 */
export function InternetSpeedTester({ onResultUpdate, onResultClear, toolId, toolTitle, toolSlug }: InternetSpeedTesterProps) {
  // Owns its banner (direct-mount in ToolRenderer): useTestResult keeps the
  // last verdict visible (Phase 1 semantics) and forwards results + clears
  // to the guided-inspection host exactly like the other direct testers.
  const { result, emitRich, clear } = useTestResult({ onResultClear });
  const recordResultRef = useRef(onResultUpdate);
  useEffect(() => {
    recordResultRef.current = onResultUpdate;
  }, [onResultUpdate]);
  const [state, setState] = useState<SpeedState>({ phase: 'idle' });
  const [summary, setSummary] = useState<SpeedSummary>(EMPTY_SUMMARY);
  const controllerRef = useRef<CloudflareSpeedTestController | null>(null);
  /** Latest progress values, readable synchronously at the finish transition. */
  const summaryRef = useRef<SpeedSummary>(EMPTY_SUMMARY);

  // Departure: cancel ongoing work through the adapter.
  useEffect(
    () => () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    },
    []
  );

  const handleProgress = useCallback((s: SpeedSummary) => {
    summaryRef.current = s;
    setSummary(s);
  }, []);

  const handlePhase = useCallback((phase: SpeedPhase, error?: string) => {
    setState({ phase, error });
    // Result plumbing (post-deployment pass): the run's outcome reaches the
    // shared banner → browser-local history → privacy-safe share. A completed
    // measurement is reported NEUTRALLY ('inconclusive' = observation, not a
    // verdict); 'aborted' deliberately emits nothing — a cancelled run records
    // no result, so partial values can never be presented as a success.
    if (phase === 'finished') {
      const s = summaryRef.current;
      const parts = [
        s.downloadMbps !== null ? `download ${s.downloadMbps} Mbps` : null,
        s.uploadMbps !== null ? `upload ${s.uploadMbps} Mbps` : null,
        s.latencyMs !== null ? `latency ${s.latencyMs} ms` : null,
        s.jitterMs !== null ? `jitter ${s.jitterMs} ms` : null,
      ].filter(Boolean);
      const text =
        parts.length > 0
          ? `Measurement complete — ${parts.join(', ')}.`
          : 'Measurement completed, but the engine returned no usable values.';
      // Phase 3: the completed measurement is emitted with ONLY the real
      // numeric values, so the banner can offer rerun comparison and an
      // honest CSV export. 'measurement' documents how values were obtained
      // (text, so both features skip it). Status stays NEUTRAL — a finished
      // download number is an observation, never a pass/fail verdict.
      const metrics: Record<string, unknown> = {};
      if (s.downloadMbps !== null) metrics.downloadMbps = s.downloadMbps;
      if (s.uploadMbps !== null) metrics.uploadMbps = s.uploadMbps;
      if (s.latencyMs !== null) metrics.latencyMs = s.latencyMs;
      if (s.jitterMs !== null) metrics.jitterMs = s.jitterMs;
      metrics.measurement = 'HTTP transfers via the Cloudflare measurement engine';
      emitRich({ status: 'inconclusive', details: text, metrics });
      recordResultRef.current?.('inconclusive', text);
    } else if (phase === 'error') {
      emitRich({ status: 'failed', details: 'The measurement failed before completion — see the error above.' });
      recordResultRef.current?.('failed', 'The measurement failed before completion — see the error above.');
    }
  }, [emitRich]);

  const start = useCallback(() => {
    if (state.phase === 'running') return;
    controllerRef.current?.dispose();
    setSummary(EMPTY_SUMMARY);
    summaryRef.current = EMPTY_SUMMARY;
    const controller = new CloudflareSpeedTestController({
      onPhase: handlePhase,
      onProgress: handleProgress,
    });
    controllerRef.current = controller;
    void controller.start();
  }, [state.phase, handlePhase, handleProgress]);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
    setState({ phase: 'aborted' });
  }, []);

  const running = state.phase === 'running';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {state.phase === 'idle' && (
          <button
            onClick={start}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Start Speed Test
          </button>
        )}
        {running && (
          <button
            onClick={cancel}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Square className="w-4 h-4" />
            Cancel
          </button>
        )}
        {(state.phase === 'finished' || state.phase === 'error' || state.phase === 'aborted') && (
          <button
            onClick={start}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Run Again
          </button>
        )}
        {running && (
          <span className="text-xs font-semibold text-[#0F766E] dark:text-[#14B8A6] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0F766E] dark:bg-[#14B8A6] animate-pulse" />
            Measuring… stay on this tab
          </span>
        )}
      </div>

      {state.phase === 'error' && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">The measurement failed</p>
            <p className="mt-1 opacity-90 break-all">{state.error ?? 'An unknown error occurred.'}</p>
            <p className="mt-1 opacity-80">
              An ad blocker, VPN, or corporate proxy that blocks the measurement endpoints will
              prevent the test from running.
            </p>
          </div>
        </div>
      )}

      {state.phase === 'aborted' && (
        <p role="status" className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          Test cancelled — no result recorded. Run again for a complete measurement.
        </p>
      )}

      {/* Correction B: a failed or cancelled measurement must never leave
          incomplete values on screen as if they were a result. The metrics
          grid renders ONLY when the engine finished every phase. */}
      {state.phase === 'finished' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Download" value={summary.downloadMbps} unit="Mbps" />
          <Metric label="Upload" value={summary.uploadMbps} unit="Mbps" />
          <Metric label="Latency" value={summary.latencyMs} unit="ms" />
          <Metric label="Jitter" value={summary.jitterMs} unit="ms" />
        </div>
      )}
      {running && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-hidden="true">
          <Metric label="Download" value={null} unit="Mbps" />
          <Metric label="Upload" value={null} unit="Mbps" />
          <Metric label="Latency" value={null} unit="ms" />
          <Metric label="Jitter" value={null} unit="ms" />
        </div>
      )}

      {/* One concise disclosure next to Start (correction B): the test
          transfers real data through Cloudflare's external measurement
          network. Provider and privacy detail stay in the box below and on
          the privacy page. */}
      {state.phase === 'idle' && (
        <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] leading-relaxed max-w-2xl">
          Pressing Start transfers real data through Cloudflare&apos;s external
          measurement network — your connection carries the test traffic, and
          it can consume significant mobile data. Everything else on DeviceTry
          stays in your browser.
        </p>
      )}

      <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[11px] text-[#59677D] dark:text-[#9AA6B8] leading-relaxed space-y-2">
        <p className="flex items-start gap-2 font-semibold text-[#142033] dark:text-[#E9EEF4]">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#0F766E] dark:text-[#14B8A6]" />
          This test transfers real data and can consume a substantial mobile-data allowance.
        </p>
        <p>
          Measurements run against Cloudflare&apos;s public measurement network
          (speed.cloudflare.com) via the official engine — see the disclosure above and the
          privacy page for exactly what leaves your device. Results reflect your connection to
          that network at this moment — other networks and times differ.
        </p>
        <p>
          &quot;Latency&quot; here is HTTP round-trip timing to the measurement endpoint, not ICMP
          ping. Measurement results are collected by Cloudflare on completion for aggregated
          internet-quality insights; see Cloudflare&apos;s documentation and the site privacy page.
        </p>
      </div>

      {/* Shared verdict banner: measurement, safe share, history, export,
          and Phase 3 rerun comparison — identical to every other tester. */}
      <TestResultBanner result={result} onClear={clear} toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />
    </div>
  );
}
