'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mouse, RotateCcw, Zap } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function ClickCounterTester({ onResultUpdate }: ToolComponentProps) {
  const [duration, setDuration] = useState<number>(5); // 5s, 10s, 30s, or 0 (freeform)
  const [mode, setMode] = useState<'mouse' | 'spacebar'>('mouse');
  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle');
  const [clicks, setClicks] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(5);
  const [cps, setCps] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('idle');
    setClicks(0);
    setTimeLeft(duration);
    setCps(0);
    startTimeRef.current = null;
  }, [duration]);

  // Reset state synchronously when the configuration changes, without an effect.
  const configKey = useMemo(() => `${duration}:${mode}`, [duration, mode]);
  const [prevConfigKey, setPrevConfigKey] = useState(configKey);
  if (prevConfigKey !== configKey) {
    setPrevConfigKey(configKey);
    resetTest();
  }

  const finishTest = useCallback((finalCount: number, elapsedSecs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('finished');
    const computedCps = elapsedSecs > 0 ? parseFloat((finalCount / elapsedSecs).toFixed(2)) : 0;
    setCps(computedCps);
    if (onResultUpdate) {
      onResultUpdate('passed', `Result: ${finalCount} clicks (${computedCps} CPS)`);
    }
  }, [onResultUpdate]);

  const registerHit = useCallback(() => {
    if (status === 'finished') return;

    if (status === 'idle') {
      setStatus('running');
      startTimeRef.current = performance.now();
      setClicks(1);

      if (duration > 0) {
        setTimeLeft(duration);
        timerRef.current = setInterval(() => {
          if (!startTimeRef.current) return;
          const elapsed = (performance.now() - startTimeRef.current) / 1000;
          const remaining = Math.max(0, duration - elapsed);
          setTimeLeft(parseFloat(remaining.toFixed(1)));

          if (remaining <= 0) {
            setClicks((current) => {
              finishTest(current, duration);
              return current;
            });
          }
        }, 50);
      }
      return;
    }

    if (status === 'running') {
      setClicks((c) => {
        const next = c + 1;
        if (startTimeRef.current) {
          const elapsed = (performance.now() - startTimeRef.current) / 1000;
          if (elapsed > 0) {
            setCps(parseFloat((next / elapsed).toFixed(2)));
          }
        }
        return next;
      });
    }
  }, [status, duration, finishTest]);

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

  return (
    <div className="space-y-6">
      {/* Setup configuration controls */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4">
        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-[#F6F8FB] dark:bg-[#192332] p-1 rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
          <button
            onClick={() => setMode('mouse')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              mode === 'mouse'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'text-[#59677D] dark:text-[#9AA6B8] hover:text-[#172033]'
            }`}
          >
            Mouse Clicks
          </button>
          <button
            onClick={() => setMode('spacebar')}
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
              onClick={() => setDuration(sec)}
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
