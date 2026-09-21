'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Timer, RotateCcw, Play } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { useTestResult, TestResultBanner } from '@/components/TestResultBanner';
import {
  ReactionRun,
  ReactionSummary,
  ATTEMPTS_PER_SESSION,
} from '@/lib/testing/reactionTime';

interface ReactionTimeTesterProps {
  t?: Translations;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

/**
 * Reaction Time Test (Phase 9, item F). Timing rules live in ReactionRun
 * (lib/testing/reactionTime.ts). Input accepts pointer and keyboard; page
 * visibility cancels the in-flight attempt; departure cancels pending timers
 * and invalidates stale callbacks. A slower result is a normal observation —
 * never reported as defective hardware.
 */
export function ReactionTimeTester({ onResultUpdate }: ReactionTimeTesterProps) {
  const { result, emit, clear, invalidate, startRun, currentRun } = useTestResult({});
  const runRef = useRef<ReactionRun | null>(null);
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'signal' | 'done'>('idle');
  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);

  // Lazily construct the run so the injected clock is the real one.
  const getRun = useCallback(() => {
    if (!runRef.current) {
      runRef.current = new ReactionRun();
    }
    return runRef.current;
  }, []);

  // Page hidden mid-attempt: cancel that attempt (stale-callback safe).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        runRef.current?.hiddenDuringAttempt();
        setPhase(runRef.current?.currentPhase ?? 'idle');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      runRef.current?.dispose();
    };
  }, []);

  const publishSession = useCallback(
    (s: ReactionSummary) => {
      if (s.median !== null) {
        // Honest, neutral reporting: descriptive stats only.
        emit('inconclusive', `Session complete — best ${Math.round(s.best ?? 0)} ms, median ${Math.round(s.median)} ms over ${ATTEMPTS_PER_SESSION} valid attempts.`);
      }
    },
    [emit]
  );

  const startAttempt = useCallback(() => {
    const run = getRun();
    if (run.sessionComplete || phase === 'waiting' || phase === 'signal') return;
    startRun(); // new observation: clears previous verdict exactly once
    setLastOutcome(null);
    run.beginAttempt();
    setPhase(run.currentPhase);
  }, [getRun, phase, startRun]);

  const handleRespond = useCallback(() => {
    const run = getRun();
    if (phase === 'waiting') {
      run.respond(); // too-soon: invalidated attempt
      setLastOutcome('Too soon — wait for green. That attempt did not count.');
      setPhase(run.currentPhase);
      setSummary(run.results);
      return;
    }
    if (phase === 'signal') {
      const outcome = run.respond();
      setPhase(run.currentPhase);
      setSummary(run.results);
      if (outcome === 'measured' && run.sessionComplete) {
        setLastOutcome(null);
        publishSession(run.results);
      }
    }
  }, [getRun, phase, publishSession]);

  // Keyboard: Space/Enter respond; Space/Enter also start attempts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      if (phase === 'idle') startAttempt();
      else handleRespond();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, startAttempt, handleRespond]);

  const restart = useCallback(() => {
    const run = getRun();
    run.reset();
    setPhase('idle');
    setSummary(null);
    setLastOutcome(null);
    clear();
  }, [getRun, clear]);

  const panelColor =
    phase === 'signal'
      ? 'bg-emerald-500'
      : phase === 'waiting'
        ? 'bg-red-500/80'
        : 'bg-[#F6F7F9] dark:bg-[#192332]';

  const attempts = summary?.attempts ?? [];

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label={
          phase === 'signal'
            ? 'Respond now'
            : phase === 'waiting'
              ? 'Wait for green'
              : 'Start a reaction attempt'
        }
        onClick={() => (phase === 'idle' ? startAttempt() : handleRespond())}
        onKeyDown={(e) => {
          if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();
        }}
        className={`relative h-56 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] ${panelColor} transition-colors duration-100 flex items-center justify-center select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]`}
      >
        <div className="text-center px-6">
          {phase === 'idle' && (
            <>
              <Play className="w-8 h-8 mx-auto text-[#0F766E] dark:text-[#14B8A6] mb-2" />
              <p className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">
                Click, tap, or press Space to start
              </p>
              <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-1">
                Wait for green, then respond as fast as you can.
              </p>
            </>
          )}
          {phase === 'waiting' && (
            <p className="text-lg font-bold text-white">Wait for green…</p>
          )}
          {phase === 'signal' && (
            <p className="text-lg font-bold text-white">Click / tap / press a key NOW</p>
          )}
          {phase === 'done' && (
            <>
              <Timer className="w-8 h-8 mx-auto text-[#0F766E] dark:text-[#14B8A6] mb-2" />
              <p className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">Session complete</p>
            </>
          )}
        </div>
      </div>

      {lastOutcome && (
        <p role="status" className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          {lastOutcome}
        </p>
      )}

      {attempts.length > 0 && (
        <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#172033] dark:text-[#E9EEF4]">
              Attempts ({summary?.times.length ?? 0}/{ATTEMPTS_PER_SESSION} valid)
            </p>
            <button
              onClick={restart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {attempts.map((a, i) => (
              <span
                key={i}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-num font-bold ${
                  a.outcome === 'measured'
                    ? 'bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6]'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                }`}
                title={a.outcome}
              >
                {a.outcome === 'measured' ? `${a.ms} ms` : a.outcome === 'too-soon' ? 'too soon' : 'cancelled'}
              </span>
            ))}
          </div>
          {summary?.times.length ? (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#59677D] dark:text-[#9AA6B8]">
              <span>
                Best: <b className="text-[#142033] dark:text-[#E9EEF4]">{Math.round(summary.best ?? 0)} ms</b>
              </span>
              <span>
                Median: <b className="text-[#142033] dark:text-[#E9EEF4]">{Math.round(summary.median ?? 0)} ms</b>
              </span>
            </div>
          ) : null}
          <p className="mt-3 text-[11px] text-[#8996A6] leading-relaxed">
            Screen refresh, input-device latency, and browser scheduling all affect these numbers.
            Slower results are normal variation — not evidence of defective hardware. This is a
            browser-timing measurement, not a medical or cognitive assessment.
          </p>
        </div>
      )}

      <TestResultBanner result={result} onClear={clear} />
    </div>
  );
}
