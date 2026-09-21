'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gauge, Play, Square, RotateCcw, AlertCircle, Info } from 'lucide-react';
import {
  CloudflareSpeedTestController,
  SpeedSummary,
  SpeedPhase,
} from '@/lib/testing/speedProvider';

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
export function InternetSpeedTester() {
  const [state, setState] = useState<SpeedState>({ phase: 'idle' });
  const [summary, setSummary] = useState<SpeedSummary>(EMPTY_SUMMARY);
  const controllerRef = useRef<CloudflareSpeedTestController | null>(null);

  // Departure: cancel ongoing work through the adapter.
  useEffect(
    () => () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    },
    []
  );

  const handlePhase = useCallback((phase: SpeedPhase, error?: string) => {
    setState({ phase, error });
  }, []);

  const start = useCallback(() => {
    if (state.phase === 'running') return;
    controllerRef.current?.dispose();
    setSummary(EMPTY_SUMMARY);
    const controller = new CloudflareSpeedTestController({
      onPhase: handlePhase,
      onProgress: setSummary,
    });
    controllerRef.current = controller;
    void controller.start();
  }, [state.phase, handlePhase]);

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
          Test cancelled — partial values above are provisional, not a result.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Download" value={summary.downloadMbps} unit="Mbps" />
        <Metric label="Upload" value={summary.uploadMbps} unit="Mbps" />
        <Metric label="Latency" value={summary.latencyMs} unit="ms" />
        <Metric label="Jitter" value={summary.jitterMs} unit="ms" />
      </div>

      <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[11px] text-[#59677D] dark:text-[#9AA6B8] leading-relaxed space-y-2">
        <p className="flex items-start gap-2 font-semibold text-[#142033] dark:text-[#E9EEF4]">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#0F766E] dark:text-[#14B8A6]" />
          This test transfers real data and can consume a substantial mobile-data allowance.
        </p>
        <p>
          Measurements run against Cloudflare&apos;s public measurement network
          (speed.cloudflare.com) via the official engine. Results reflect your connection to that
          network at this moment — other networks and times differ.
        </p>
        <p>
          &quot;Latency&quot; here is HTTP round-trip timing to the measurement endpoint, not ICMP
          ping. Measurement results are collected by Cloudflare on completion for aggregated
          internet-quality insights; see Cloudflare&apos;s documentation and the site privacy page.
        </p>
      </div>
    </div>
  );
}
