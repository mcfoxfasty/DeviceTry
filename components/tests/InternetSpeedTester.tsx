'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Play, Square, RotateCcw, AlertCircle, Info } from 'lucide-react';
import {
  CloudflareSpeedTestController,
  SpeedSummary,
  SpeedPhase,
  describeSpeedPhase,
} from '@/lib/testing/speedProvider';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import type { SpeedPhaseInfo } from '@/lib/testing/speedProvider';

interface InternetSpeedTesterProps {
  /** Host telemetry sink — also feeds the shared banner (history + safe share). */
  onResultUpdate?: (
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured' | 'unsupported',
    details?: string,
    metrics?: Record<string, unknown>
  ) => void;
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
    <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] min-w-0">
      {/* min-w-0 + break-words: without a min-width floor these cards let the
          grid column collapse on narrow phones and the label wrapped one
          character per line. Words wrap; characters do not. */}
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8996A6] break-words">{label}</p>
      <p className="mt-1 text-2xl font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4] break-words">
        {value === null ? '—' : value.toLocaleString('en-US')}
        <span className="text-xs font-semibold text-[#59677D] dark:text-[#9AA6B8] ml-1.5 whitespace-nowrap">{unit}</span>
      </p>
    </div>
  );
}

/**
 * Live speedometer.
 *
 * Both the needle and the printed number come from the engine's OWN live
 * measurements: `onProgress` (SpeedSummary) supplies the bandwidth figure of
 * the phase that is actually running and `onPhaseChange` (SpeedPhaseInfo)
 * says which phase that is. During a download step the dial follows the
 * download figure, during an upload step the upload figure, and while a
 * latency step is active — or before the engine reports its first step — the
 * needle rests at zero and the value reads "—", exactly like the live chips
 * below. No reading is ever invented, extrapolated, or paced to a clock; the
 * only motion beyond the engine's own updates is a CSS ease between two
 * values the engine really reported (disabled under prefers-reduced-motion).
 */

/** Upper end of the dial. Log placement only — the printed value is exact. */
const GAUGE_MAX_MBPS = 1000;
/** Dial graduations: 0, then one, ten, a hundred, a thousand Mbps. */
const GAUGE_TICKS = [0, 1, 10, 100, 1000];
/** The dial spans 240°, 120° either side of straight up. */
const GAUGE_SWEEP_DEG = 240;
const GAUGE = { cx: 110, cy: 106, radius: 78, needle: 58 };

/**
 * Where a value sits on the dial, 0..1. Logarithmic so a 300 Mbps fibre line
 * and a 3 Mbps mobile line are both readable on one face; clamping past the
 * top end is a display choice, never applied to the printed number.
 */
function gaugeFraction(mbps: number): number {
  const clamped = Math.min(Math.max(mbps, 0), GAUGE_MAX_MBPS);
  return Math.log10(1 + clamped) / Math.log10(1 + GAUGE_MAX_MBPS);
}

function gaugeAngle(fraction: number): number {
  return -GAUGE_SWEEP_DEG / 2 + GAUGE_SWEEP_DEG * fraction;
}

function gaugePoint(radius: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: GAUGE.cx + radius * Math.sin(rad), y: GAUGE.cy - radius * Math.cos(rad) };
}

function SpeedometerGauge({ valueMbps, phaseLabel }: { valueMbps: number | null; phaseLabel: string }) {
  const fraction = valueMbps === null ? 0 : gaugeFraction(valueMbps);
  const angle = gaugeAngle(fraction);
  const trackStart = gaugePoint(GAUGE.radius, gaugeAngle(0));
  const trackEnd = gaugePoint(GAUGE.radius, gaugeAngle(1));
  const valueEnd = gaugePoint(GAUGE.radius, angle);
  const arc = (end: { x: number; y: number }, largeArc: 0 | 1) =>
    `M ${trackStart.x} ${trackStart.y} A ${GAUGE.radius} ${GAUGE.radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  const readout = valueMbps === null ? '—' : valueMbps.toLocaleString('en-US');

  return (
    <figure className="flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 220 150"
        className="w-full max-w-[220px] h-auto"
        role="img"
        aria-label={`${phaseLabel}: ${valueMbps === null ? 'no live value reported yet' : `${readout} Mbps`}`}
      >
        {/* Dial track. */}
        <path
          d={arc(trackEnd, 1)}
          fill="none"
          className="stroke-[#DFE5EB] dark:stroke-[#223043]"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Value arc: drawn only from a value the engine reported. */}
        {valueMbps !== null && fraction > 0.001 && (
          <path
            d={arc(valueEnd, GAUGE_SWEEP_DEG * fraction > 180 ? 1 : 0)}
            fill="none"
            className="stroke-[#0F766E] dark:stroke-[#14B8A6]"
            strokeWidth={6}
            strokeLinecap="round"
          />
        )}
        {GAUGE_TICKS.map((tick) => {
          const tickAngle = gaugeAngle(gaugeFraction(tick));
          const inner = gaugePoint(GAUGE.radius - 14, tickAngle);
          const outer = gaugePoint(GAUGE.radius - 6, tickAngle);
          const label = gaugePoint(GAUGE.radius - 26, tickAngle);
          return (
            <g key={tick}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                className="stroke-[#C9D2DC] dark:stroke-[#2C3A4E]"
                strokeWidth={1.5}
              />
              <text
                x={label.x}
                y={label.y}
                dy="0.32em"
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                className="fill-[#8996A6] dark:fill-[#677589]"
              >
                {tick}
              </text>
            </g>
          );
        })}
        {/* Needle: rotated to the live value, eased between reported values. */}
        <g
          className="motion-reduce:transition-none"
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${GAUGE.cx}px ${GAUGE.cy}px`,
            transformBox: 'view-box',
            transition: 'transform 400ms ease-out',
          }}
        >
          <line
            x1={GAUGE.cx}
            y1={GAUGE.cy}
            x2={GAUGE.cx}
            y2={GAUGE.cy - GAUGE.needle}
            className="stroke-[#0F766E] dark:stroke-[#14B8A6]"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
        <circle cx={GAUGE.cx} cy={GAUGE.cy} r={5} className="fill-[#0F766E] dark:fill-[#14B8A6]" />
        <text
          x={GAUGE.cx}
          y={GAUGE.cy + 24}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          className="fill-[#8996A6] dark:fill-[#677589]"
        >
          Mbps
        </text>
      </svg>
      <figcaption className="text-center">
        <span className="block text-2xl font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4]">
          {readout}
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#14B8A6]">
          {phaseLabel}
        </span>
      </figcaption>
    </figure>
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
  /** Real engine-reported progress during the run (defect 2: live values). */
  const [phaseInfo, setPhaseInfo] = useState<SpeedPhaseInfo | null>(null);
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
    if (phase !== 'running') setPhaseInfo(null);
    // A run that ended without a complete measurement (cancel or failure)
    // leaves nothing behind: the live chips and the dial reset together.
    // 'finished' deliberately keeps its values — that summary IS the result.
    if (phase === 'aborted' || phase === 'error') {
      setSummary(EMPTY_SUMMARY);
      summaryRef.current = EMPTY_SUMMARY;
    }
    // Result plumbing (post-deployment pass): the run's outcome reaches the
    // shared banner → browser-local history → privacy-safe share. A COMPLETED
    // measurement is emitted as 'measured' (defect 1): a real value from a
    // finished run is not an "inconclusive" result — inconclusive now only
    // covers runs that produced nothing usable. It still never claims
    // pass/fail. 'aborted' deliberately emits nothing — a cancelled run
    // records no result, so partial values can never be presented as success.
    if (phase === 'finished') {
      const s = summaryRef.current;
      const parts = [
        s.downloadMbps !== null ? `download ${s.downloadMbps} Mbps` : null,
        s.uploadMbps !== null ? `upload ${s.uploadMbps} Mbps` : null,
        s.latencyMs !== null ? `latency ${s.latencyMs} ms` : null,
        s.jitterMs !== null ? `jitter ${s.jitterMs} ms` : null,
      ].filter(Boolean);
      const hasUsable = parts.length > 0;
      const text = hasUsable
        ? `Measurement complete — ${parts.join(', ')}.`
        : 'Measurement completed, but the engine returned no usable values.';
      // Phase 3: the completed measurement is emitted with ONLY the real
      // numeric values, so the banner can offer rerun comparison and an
      // honest CSV export. 'measurement' documents how values were obtained
      // (text, so both features skip it).
      const metrics: Record<string, unknown> = {};
      if (s.downloadMbps !== null) metrics.downloadMbps = s.downloadMbps;
      if (s.uploadMbps !== null) metrics.uploadMbps = s.uploadMbps;
      if (s.latencyMs !== null) metrics.latencyMs = s.latencyMs;
      if (s.jitterMs !== null) metrics.jitterMs = s.jitterMs;
      metrics.measurement = 'HTTP transfers via the Cloudflare measurement engine';
      emitRich({ status: hasUsable ? 'measured' : 'inconclusive', details: text, metrics });
      recordResultRef.current?.(hasUsable ? 'measured' : 'inconclusive', text);
    } else if (phase === 'error') {
      emitRich({ status: 'failed', details: 'The measurement failed before completion — see the error above.' });
      recordResultRef.current?.('failed', 'The measurement failed before completion — see the error above.');
    }
  }, [emitRich]);

  /** Real step progress from the engine — displayed verbatim, never invented. */
  const handlePhaseInfo = useCallback((info: SpeedPhaseInfo) => {
    setPhaseInfo(info);
  }, []);

  const start = useCallback(() => {
    if (state.phase === 'running') return;
    controllerRef.current?.dispose();
    // A new run starts from a clean dial: no leftover value or phase from the
    // previous attempt can be shown while this one waits for its first report.
    setSummary(EMPTY_SUMMARY);
    summaryRef.current = EMPTY_SUMMARY;
    setPhaseInfo(null);
    const controller = new CloudflareSpeedTestController({
      onPhase: handlePhase,
      onProgress: handleProgress,
      onPhaseInfo: handlePhaseInfo,
    });
    controllerRef.current = controller;
    void controller.start();
  }, [state.phase, handlePhase, handleProgress, handlePhaseInfo]);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
    // controller.cancel() reports 'aborted' synchronously, which already
    // resets the phase info; the live summary resets here so a cancelled run
    // cannot leave a half-measurement in state either.
    setSummary(EMPTY_SUMMARY);
    summaryRef.current = EMPTY_SUMMARY;
    setState({ phase: 'aborted' });
  }, []);

  const running = state.phase === 'running';

  /**
   * Concise active-phase label derived ONLY from the engine's own
   * onPhaseChange payload (lib/testing/speedProvider.describeSpeedPhase).
   * Before the engine reports its first step it reads simply "Measuring…".
   * Nothing here is fabricated or animated.
   */
  const phaseLabel = useMemo(() => (running ? describeSpeedPhase(phaseInfo) : ''), [running, phaseInfo]);

  /**
   * Value on the dial: the engine's own bandwidth figure for the phase that
   * is actually running. While a latency step is active — or before the
   * engine reports its first step — there is no live bandwidth value, so the
   * needle rests and the readout shows "—" rather than a stale number.
   */
  const gaugeMbps =
    phaseInfo?.type === 'download'
      ? summary.downloadMbps
      : phaseInfo?.type === 'upload'
        ? summary.uploadMbps
        : null;

  /** The phase the needle is following, named from the engine's step type. */
  const gaugePhase =
    phaseInfo?.type === 'download'
      ? 'Downloading'
      : phaseInfo?.type === 'upload'
        ? 'Uploading'
        : phaseInfo?.type === 'latency'
          ? 'Checking latency'
          : 'Measuring';

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
          <span className="text-xs font-semibold text-[#0F766E] dark:text-[#14B8A6] flex items-center gap-2 min-w-0 break-words">
            <span className="w-2 h-2 rounded-full bg-[#0F766E] dark:bg-[#14B8A6] animate-pulse" />
            {phaseLabel}
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
          incomplete values on screen as if they were a result. The final
          metrics grid renders ONLY when the engine finished every phase. */}
      {state.phase === 'finished' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Download" value={summary.downloadMbps} unit="Mbps" />
          <Metric label="Upload" value={summary.uploadMbps} unit="Mbps" />
          <Metric label="Latency" value={summary.latencyMs} unit="ms" />
          <Metric label="Jitter" value={summary.jitterMs} unit="ms" />
        </div>
      )}
      {/* During the run, the engine's REAL current values are shown as live
          readings. These are the same numbers onResultsChange reports —
          nothing is animated, extrapolated, or fabricated. A metric the
          engine has not produced yet renders as "—".

          The short "Live" chip plus the toolbar's "Measuring… <phase>" label
          is all the distinction these need from the finished grid below:
          two words instead of a disclaimer sentence. The finished grid is
          still the only one that counts as a result. */}
      {running && (
        <div className="space-y-3">
          {/* The dial follows the live download/upload measurements; it is
              mounted only while a run is in progress, so finishing, failing,
              or cancelling removes it and the next run starts it at zero. */}
          <SpeedometerGauge valueMbps={gaugeMbps} phaseLabel={gaugePhase} />
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[#EAF4F2] dark:bg-[#0E1B1A] text-[#0F766E] dark:text-[#14B8A6]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E] dark:text-[#14B8A6] animate-pulse" />
                Live
              </span>
              <span className="text-[11px] text-[#59677D] dark:text-[#9AA6B8]">{phaseLabel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Download" value={summary.downloadMbps} unit="Mbps" />
              <Metric label="Upload" value={summary.uploadMbps} unit="Mbps" />
              <Metric label="Latency" value={summary.latencyMs} unit="ms" />
              <Metric label="Jitter" value={summary.jitterMs} unit="ms" />
            </div>
          </div>
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
