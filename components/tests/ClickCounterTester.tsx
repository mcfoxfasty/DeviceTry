'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mouse, RotateCcw, Zap } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { BoundedCpsRun, computeCps } from '@/lib/testing/clickSpeed';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured',
    details?: string,
    metrics?: Record<string, unknown>
  ) => void;
}

export function ClickCounterTester({ onResultUpdate }: ToolComponentProps) {
  const [duration, setDuration] = useState<number>(5); // 5s, 10s, 30s, or 0 (freeform)
  const [mode, setMode] = useState<'mouse' | 'spacebar'>('mouse');
  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle');
  const [clicks, setClicks] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(5);
  const [cps, setCps] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * The authoritative run. Click counting and timing live HERE, not in React
   * state, so finishing a run never has to read state from inside a state
   * updater — which is what produced "Cannot update TesterWithBanner while
   * rendering ClickCounterTester". The component drives this from event
   * handlers and timer ticks, then forwards the result from ordinary event
   * context.
   */
  const runRef = useRef<BoundedCpsRun | null>(null);
  // Latest host callback, read at event time so the timer never closes over
  // a stale prop and no callback identity churn restarts the interval.
  const onResultUpdateRef = useRef(onResultUpdate);
  useEffect(() => {
    onResultUpdateRef.current = onResultUpdate;
  }, [onResultUpdate]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetTest = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setClicks(0);
    setTimeLeft(duration);
    setCps(0);
    runRef.current = null;
  }, [duration, clearTimer]);

  // Changing configuration starts a fresh challenge: reset in the event
  // handler (allowed) instead of during render.
  const setDurationWithReset = useCallback(
    (sec: number) => {
      setDuration(sec);
      clearTimer();
      setStatus('idle');
      setClicks(0);
      setTimeLeft(sec);
      setCps(0);
      runRef.current = null;
    },
    [clearTimer]
  );

  const setModeWithReset = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setClicks(0);
    setTimeLeft(duration);
    setCps(0);
    runRef.current = null;
  }, [duration, clearTimer]);

  // Reset on configuration change is handled by the config buttons above
  // (setDurationWithReset/setModeWithReset) — never during render.

  /**
   * End the run from an event/timer callback. The result is read from the
   * run object and forwarded to the host HERE — outside every state
   * updater — so no parent update happens during render.
   */
  const finishTest = useCallback(
    (run: BoundedCpsRun) => {
      clearTimer();
      setStatus('finished');
      const result = run.result(performance.now());
      setClicks(result.clicks);
      setCps(result.cps);
      if (onResultUpdateRef.current && result.durationSeconds > 0) {
        // A completed bounded run produced a real counted value → 'measured'.
        // It is a neutral completed observation, NOT inconclusive (that now
        // means genuinely unusable/incomplete) and never a pass/fail skill
        // rating. Numeric metrics ride along for rerun comparison — only the
        // actually counted values.
        onResultUpdateRef.current(
          'measured',
          `Result: ${result.clicks} clicks (${result.cps} CPS)`,
          {
            clicks: result.clicks,
            cps: result.cps,
            durationSeconds: result.durationSeconds,
            inputMode: result.inputMode,
          }
        );
      }
    },
    [clearTimer]
  );

  const registerHit = useCallback(() => {
    if (status === 'finished') return;

    if (status === 'idle') {
      setStatus('running');
      const run = new BoundedCpsRun(duration, mode);
      runRef.current = run;
      const count = run.hit(performance.now());
      setClicks(count);
      setCps(computeCps(count, run.elapsedSeconds(performance.now())));

      if (duration > 0) {
        setTimeLeft(duration);
        timerRef.current = setInterval(() => {
          const active = runRef.current;
          if (!active) return;
          // Timer callback context: reading the run and calling the host is
          // safe here — it is not a render or state-updater context.
          const tick = active.tick(performance.now());
          setTimeLeft(tick.remaining);
          if (tick.finished) {
            finishTest(active);
          }
        }, 50);
      }
      return;
    }

    if (status === 'running') {
      const active = runRef.current;
      if (!active) return;
      const now = performance.now();
      const next = active.hit(now);
      setClicks(next);
      setCps(active.liveCps(now));
    }
  }, [status, duration, mode, finishTest]);

  // Spacebar listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'spacebar' && e.code === 'Space') {
        e.preventDefault();
        registerHit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, registerHit]);

  // Departure must stop the countdown timer; it never forwards a result
  // (an abandoned run produces no verdict).
  useEffect(() => clearTimer, [clearTimer]);

  return (
    <div className="space-y-6">
      {/* Setup configuration controls */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4">
        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-[#F6F8FB] dark:bg-[#192332] p-1 rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
          <button
            onClick={() => {
              setMode('mouse');
              setModeWithReset();
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              mode === 'mouse'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'text-[#59677D] dark:text-[#9AA6B8] hover:text-[#172033]'
            }`}
          >
            Mouse Clicks
          </button>
          <button
            onClick={() => {
              setMode('spacebar');
              setModeWithReset();
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              mode === 'spacebar'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'text-[#59677D] dark:text-[#9AA6B8] hover:text-[#172033]'
            }`}
          >
            Spacebar Taps
          </button>
        </div>

        {/* Time Challenge Options */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#59677D] dark:text-[#9AA6B8] mr-2">Duration:</span>
          {[5, 10, 30].map((sec) => (
            <button
              key={sec}
              onClick={() => setDurationWithReset(sec)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                duration === sec
                  ? 'bg-[#0F766E] text-white border-[#0D665F]'
                  : 'bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Main interactive clicking pad */}
      <div
        onClick={mode === 'mouse' ? registerHit : undefined}
        className={`relative min-h-[340px] rounded-2xl border-2 flex flex-col items-center justify-center text-center p-8 select-none transition-all cursor-pointer ${
          status === 'running'
            ? 'border-[#0F766E] bg-[#E6F4F2]/30 dark:bg-[#133230]/40'
            : status === 'finished'
            ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
            : 'border-dashed border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#111D30] hover:border-[#0F766E]'
        }`}
      >
        {status === 'idle' && (
          <div className="space-y-3 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] flex items-center justify-center mx-auto">
              {mode === 'mouse' ? <Mouse className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
            </div>
            <h3 className="text-xl font-extrabold text-[#172033] dark:text-[#E9EEF4]">
              {mode === 'mouse' ? 'Click Here to Start' : 'Press Spacebar to Start'}
            </h3>
            <p className="text-xs text-[#59677D] dark:text-[#9AA6B8]">
              {duration}s countdown timer begins on your very first tap.
            </p>
          </div>
        )}

        {status === 'running' && (
          <div className="space-y-4 pointer-events-none">
            <div className="font-mono text-6xl font-black text-[#0F766E] dark:text-[#14B8A6]">
              {clicks}
            </div>
            <div className="flex items-center justify-center gap-6 text-sm font-semibold text-[#172033] dark:text-[#E9EEF4]">
              <span>Time: {timeLeft.toFixed(1)}s</span>
              <span>CPS: {cps.toFixed(1)}</span>
            </div>
          </div>
        )}

        {status === 'finished' && (
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Challenge Completed
            </span>
            <div className="font-mono text-6xl font-black text-[#172033] dark:text-[#E9EEF4]">
              {cps} <span className="text-2xl text-[#0F766E]">CPS</span>
            </div>
            <p className="text-xs text-[#59677D] dark:text-[#9AA6B8]">
              Total clicks: {clicks} in {duration} seconds
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetTest();
              }}
              className="px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
