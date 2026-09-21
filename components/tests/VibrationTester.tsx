'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Vibrate, Square, Play, CheckCircle, XCircle, HelpCircle, Hand } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface Pattern {
  id: string;
  label: string;
  desc: string;
  pattern: number | number[];
}

const PATTERNS: Pattern[] = [
  { id: 'single', label: 'Single Pulse', desc: '200 ms buzz', pattern: 200 },
  { id: 'double', label: 'Double Pulse', desc: 'Two 120 ms taps', pattern: [120, 100, 120] },
  { id: 'sos', label: 'SOS Morse', desc: '· · · — — — · · ·', pattern: [80, 60, 80, 60, 80, 160, 200, 60, 200, 60, 200, 160, 80, 60, 80, 60, 80] },
  { id: 'heartbeat', label: 'Heartbeat', desc: 'lub-dub rhythm', pattern: [90, 90, 140, 500, 90, 90, 140, 500] },
];

export function VibrationTester({ onResultUpdate }: TesterProps) {
  const [supported] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  const [userFelt, setUserFelt] = useState<boolean | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopVibration = () => {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    try {
      nav.vibrate?.(0);
    } catch {
      /* ignore */
    }
    setActiveId(null);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Departure: stop any ongoing pattern. navigator.vibrate(0) cancels the
  // current vibration where supported.
  useEffect(() => {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      try {
        nav.vibrate?.(0);
      } catch {
        /* ignore */
      }
    };
  }, []);

  const playPattern = (p: Pattern) => {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    if (typeof nav.vibrate !== 'function') return;

    stopVibration(); // cancel any ongoing pattern first

    const accepted = nav.vibrate(p.pattern);
    setLastAction(
      accepted
        ? `Browser accepted "${p.label}" — waiting for your confirmation.`
        : `Browser rejected the vibration call (silent mode or policy)`
    );
    setActiveId(accepted ? p.id : null);
    setUserFelt(null);

    if (accepted) {
      const total = Array.isArray(p.pattern) ? p.pattern.reduce((a, b) => a + b, 0) : p.pattern;
      setAwaitingConfirmation(p.label);
      // API acceptance alone is NOT proof the user felt vibration: the
      // verdict is issued from the user's observation below.
      onResultUpdate?.(
        'inconclusive',
        `Vibration pattern "${p.label}" accepted by the API (${total} ms). The motor may still be silent (hardware, silent mode, or no motor) — confirm by touch below.`
      );
      timeoutRef.current = setTimeout(() => {
        setActiveId(null);
      }, total + 150);
    } else {
      setAwaitingConfirmation(null);
      onResultUpdate?.('failed', 'navigator.vibrate() returned false — the API path is available but the call was rejected');
    }
  };

  const recordFeel = (felt: boolean) => {
    setUserFelt(felt);
    setAwaitingConfirmation(null);
    if (felt) {
      onResultUpdate?.('passed', 'User confirmed feeling the vibration pattern — API accepted AND physically perceived.');
    } else {
      onResultUpdate?.(
        'warning',
        'API accepted the vibration call but the user did not feel it. Possible causes: device has no vibration motor, system silent/do-not-disturb mode, or hardware motor failure.'
      );
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="w-10 h-10 rounded-lg bg-[#D97706]/10 text-[#D97706] flex items-center justify-center">
          <Vibrate className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Vibration Motor Test</h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Trigger haptic pulse patterns on supported Android/mobile devices</p>
        </div>
      </div>

      {supported === false && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Vibration API unavailable</p>
            <p className="mt-1 opacity-80">
              iOS Safari does not expose navigator.vibrate for policy reasons. Test on Android using Chrome or Firefox.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PATTERNS.map((p) => (
          <button
            key={p.id}
            onClick={() => playPattern(p)}
            disabled={supported === false}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              activeId === p.id
                ? 'border-[#0F766E] bg-[#E6F4F2] dark:bg-[#133230] ring-1 ring-[#0F766E]'
                : 'border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] hover:border-[#0F766E]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">{p.label}</p>
                <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">{p.desc}</p>
              </div>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeId === p.id ? 'bg-[#0F766E] text-white animate-pulse' : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#0F766E]'}`}>
                <Play className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* User observation — the actual verdict gate */}
      {awaitingConfirmation && (
        <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
            <Hand className="w-4 h-4" />
            Did you physically feel the &quot;{awaitingConfirmation}&quot; pattern?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => recordFeel(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              Yes — felt it
            </button>
            <button
              onClick={() => recordFeel(false)}
              className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              No — didn&apos;t feel it
            </button>
          </div>
        </div>
      )}

      {userFelt !== null && !awaitingConfirmation && (
        <div className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${userFelt ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300'}`}>
          {userFelt ? <CheckCircle className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
          <span>
            {userFelt
              ? 'Vibration confirmed by touch: API accepted and pattern physically perceived.'
              : 'Not felt: API accepted the call but no vibration was perceived. Silent mode, missing motor, or motor failure.'}
          </span>
        </div>
      )}

      {activeId && (
        <button
          onClick={stopVibration}
          className="mt-4 w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Square className="w-3.5 h-3.5" /> Stop Vibration
        </button>
      )}

      {lastAction && (
        <div className="mt-4 flex items-center gap-2 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          <CheckCircle className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
          {lastAction}
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        A successful vibrate() call confirms only that the API path works — physical perception depends on the
        hardware motor and system silent mode, so the result becomes final only after your touch confirmation.
        Leaving this tool stops any ongoing vibration where the browser supports cancellation.
      </div>
    </div>
  );
}
