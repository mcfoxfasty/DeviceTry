'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Gauge, Play, Square, Activity } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported',
    details?: string,
    metrics?: Record<string, unknown>
  ) => void;
}

interface FpsResult {
  hz: number;
  avgFrameMs: number;
  minFrameMs: number;
  maxFrameMs: number;
  droppedFrames: number;
  totalFrames: number;
  durationMs: number;
}

const SAMPLE_MS = 3000;

export function DisplayFpsTester({ onResultUpdate }: TesterProps) {
  const [measuring, setMeasuring] = useState<boolean>(false);
  const [result, setResult] = useState<FpsResult | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopBenchmark = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMeasuring(false);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startBenchmark = () => {
    stopBenchmark();
    setResult(null);
    setMeasuring(true);

    const stamps: number[] = [];
    const startTime = performance.now();

    const loop = () => {
      const now = performance.now();
      stamps.push(now);
      if (now - startTime < SAMPLE_MS) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
        const deltas: number[] = [];
        for (let i = 1; i < stamps.length; i++) deltas.push(stamps[i] - stamps[i - 1]);
        const avg = deltas.reduce((a, b) => a + b, 0) / Math.max(deltas.length, 1);
        const min = Math.min(...deltas);
        const max = Math.max(...deltas);
        const dropped = deltas.filter((d) => d > avg * 1.75).length;
        const res: FpsResult = {
          hz: Math.round(1000 / avg),
          avgFrameMs: Math.round(avg * 100) / 100,
          minFrameMs: Math.round(min * 100) / 100,
          maxFrameMs: Math.round(max * 100) / 100,
          droppedFrames: dropped,
          totalFrames: stamps.length,
          durationMs: Math.round(stamps[stamps.length - 1] - startTime),
        };
        setResult(res);
        setMeasuring(false);
        // Phase 3: numeric measurements ride with the verdict so the result
        // banner can offer rerun comparison (previous Hz vs this run) and an
        // honest CSV export. Values come only from the observed frame timing.
        onResultUpdate?.(
          'passed',
          `Estimated refresh rate ~${res.hz} Hz over ${res.totalFrames} frames`,
          {
            estimatedHz: res.hz,
            avgFrameMs: res.avgFrameMs,
            droppedFrames: res.droppedFrames,
            totalFrames: res.totalFrames,
            measurement: 'requestAnimationFrame frame timing over a 3 s sample',
          }
        );
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const stability = result ? Math.max(0, Math.min(100, Math.round(100 - (result.droppedFrames / Math.max(result.totalFrames, 1)) * 100))) : null;

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Display Refresh Rate Benchmark</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Samples {SAMPLE_MS / 1000}s of animation frame timestamps</p>
          </div>
        </div>

        {measuring ? (
          <button
            onClick={stopBenchmark}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        ) : (
          <button
            onClick={startBenchmark}
            className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> Start Benchmark
          </button>
        )}
      </div>

      <div className={`mt-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        measuring
          ? 'border-[#0F766E] bg-[#E6F4F2]/40 dark:bg-[#133230]/40'
          : 'border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332]'
      }`}>
        {measuring ? (
          <div className="space-y-2">
            <Activity className="w-10 h-10 mx-auto text-[#0F766E] dark:text-[#14B8A6] animate-pulse" />
            <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">Sampling frame cadence…</p>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Keep this tab in the foreground and avoid resizing the window.</p>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="font-mono-num text-5xl font-black text-[#0F766E] dark:text-[#14B8A6]">
              ~{result.hz}<span className="text-xl"> Hz</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs max-w-xl mx-auto">
              <div className="p-3 rounded-lg bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043]">
                <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">Avg frame</p>
                <p className="font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4]">{result.avgFrameMs} ms</p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043]">
                <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">Min / Max</p>
                <p className="font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4]">{result.minFrameMs} / {result.maxFrameMs}</p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043]">
                <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">Frames captured</p>
                <p className="font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4]">{result.totalFrames}</p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043]">
                <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">Dropped</p>
                <p className="font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4]">{result.droppedFrames}</p>
              </div>
            </div>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              Frame cadence stability: <span className="font-semibold">{stability}%</span> • Measured over {(result.durationMs / 1000).toFixed(1)}s
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Gauge className="w-10 h-10 mx-auto opacity-40 text-[#5F6B7A]" />
            <p className="text-sm font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">Press Start Benchmark to estimate your monitor refresh rate (60 / 120 / 144 Hz).</p>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        The result reflects the browser compositing cadence capped by monitor VSync. Laptops on battery power or power-saving modes may throttle to 60 Hz.
      </div>
    </div>
  );
}
