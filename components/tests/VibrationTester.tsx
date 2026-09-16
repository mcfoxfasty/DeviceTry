'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Vibrate, Square, Play, CheckCircle, XCircle } from 'lucide-react';
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
  const timeoutRef = useRef<number | null>(null);

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

  const stopVibration = () => {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    nav.vibrate?.(0);
    setActiveId(null);
    setLastAction('Vibration stopped');
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const playPattern = (p: Pattern) => {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    if (typeof nav.vibrate !== 'function') return;

    const accepted = nav.vibrate(p.pattern);
    setLastAction(
      accepted
        ? `Browser accepted "${p.label}" pattern — do you feel it?`
        : `Browser rejected the vibration call (silenced mode or policy)`
    );
    setActiveId(accepted ? p.id : null);

    if (accepted) {
      const total = Array.isArray(p.pattern) ? p.pattern.reduce((a, b) => a + b, 0) : p.pattern;
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setActiveId(null), total + 150);
      onResultUpdate?.('passed', `Vibration pattern "${p.label}" dispatched (${total} ms)`);
    } else {
      onResultUpdate?.('failed', 'navigator.vibrate() returned false');
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
        The browser accepting a vibrate() call confirms the API path works, but physical perception depends on the hardware motor and system silent mode — always confirm by touch.
      </div>
    </div>
  );
}
