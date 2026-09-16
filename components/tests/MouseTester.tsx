'use client';

import React, { useState, useRef } from 'react';
import { Mouse, RotateCcw, AlertTriangle, CheckCircle, ArrowUpDown } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface MouseTesterProps {
  t: Translations;
  onRecordResult?: (result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive'; details: string; metrics?: Record<string, unknown> }) => void;
}

export function MouseTester({ t, onRecordResult }: MouseTesterProps) {
  const [leftPressed, setLeftPressed] = useState<boolean>(false);
  const [middlePressed, setMiddlePressed] = useState<boolean>(false);
  const [rightPressed, setRightPressed] = useState<boolean>(false);

  const [leftCount, setLeftCount] = useState<number>(0);
  const [middleCount, setMiddleCount] = useState<number>(0);
  const [rightCount, setRightCount] = useState<number>(0);
  const [scrollDelta, setScrollDelta] = useState<number>(0);
  const [lastScrollDirection, setLastScrollDirection] = useState<'up' | 'down' | null>(null);

  // Double-click chatter observation
  const [lastClickTime, setLastClickTime] = useState<number | null>(null);
  const [lastIntervalMs, setLastIntervalMs] = useState<number | null>(null);
  const [fastDoubleClicks, setFastDoubleClicks] = useState<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = performance.now();

    if (e.button === 0) {
      setLeftPressed(true);
      setLeftCount((c) => c + 1);

      if (lastClickTime !== null) {
        const interval = Math.round(now - lastClickTime);
        setLastIntervalMs(interval);
        if (interval < 80 && interval > 5) {
          // Switch chatter / rapid involuntary double-click
          setFastDoubleClicks((f) => f + 1);
        }
      }
      setLastClickTime(now);
    } else if (e.button === 1) {
      setMiddlePressed(true);
      setMiddleCount((c) => c + 1);
    } else if (e.button === 2) {
      setRightPressed(true);
      setRightCount((c) => c + 1);
    }

    onRecordResult?.({
      status: 'passed',
      details: `Buttons verified: Left (${leftCount + 1}), Middle (${middleCount}), Right (${rightCount}). Fast double-clicks: ${fastDoubleClicks}`,
      metrics: { leftCount: leftCount + 1, middleCount, rightCount, fastDoubleClicks },
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button === 0) setLeftPressed(false);
    if (e.button === 1) setMiddlePressed(false);
    if (e.button === 2) setRightPressed(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    setScrollDelta((d) => d + Math.abs(e.deltaY));
    setLastScrollDirection(e.deltaY < 0 ? 'up' : 'down');
  };

  const resetMetrics = () => {
    setLeftCount(0);
    setMiddleCount(0);
    setRightCount(0);
    setScrollDelta(0);
    setLastScrollDirection(null);
    setLastClickTime(null);
    setLastIntervalMs(null);
    setFastDoubleClicks(0);
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Mouse className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.mouseTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.mouseTest.shortDesc}</p>
        </div>

        <button
          id="btn-reset-mouse"
          onClick={resetMetrics}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#E6F4F2] text-[#142033] dark:text-[#E9EEF4] text-xs font-medium rounded-md border border-[#DFE5EB] dark:border-[#223043] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t.mouseTest.resetCounter}
        </button>
      </div>

      {/* Button State Indicators & Mouse Diagram */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Button */}
        <div
          className={`p-4 rounded-xl border transition-all text-center ${
            leftPressed
              ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-inner'
              : leftCount > 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
          }`}
        >
          <p className="text-xs font-semibold">{t.mouseTest.leftButton}</p>
          <p className="text-2xl font-bold font-mono-num mt-2">{leftCount}</p>
          <p className="text-[11px] opacity-75 mt-1">{leftPressed ? 'Down' : leftCount > 0 ? 'Verified' : 'Click to test'}</p>
        </div>

        {/* Middle Button & Scroll Wheel */}
        <div
          className={`p-4 rounded-xl border transition-all text-center ${
            middlePressed
              ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-inner'
              : middleCount > 0 || scrollDelta > 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
          }`}
        >
          <p className="text-xs font-semibold">{t.mouseTest.middleButton} & {t.mouseTest.wheelScroll}</p>
          <p className="text-2xl font-bold font-mono-num mt-2">{middleCount} <span className="text-xs font-normal opacity-75">clicks</span></p>
          <p className="text-[11px] opacity-75 mt-1 flex items-center justify-center gap-1">
            <ArrowUpDown className="w-3 h-3" />
            {lastScrollDirection ? (lastScrollDirection === 'up' ? t.mouseTest.scrollUp : t.mouseTest.scrollDown) : 'Scroll to test'}
          </p>
        </div>

        {/* Right Button */}
        <div
          className={`p-4 rounded-xl border transition-all text-center ${
            rightPressed
              ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-inner'
              : rightCount > 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
          }`}
        >
          <p className="text-xs font-semibold">{t.mouseTest.rightButton}</p>
          <p className="text-2xl font-bold font-mono-num mt-2">{rightCount}</p>
          <p className="text-[11px] opacity-75 mt-1">{rightPressed ? 'Down' : rightCount > 0 ? 'Verified' : 'Right-click to test'}</p>
        </div>
      </div>

      {/* Interactive Click Surface */}
      <div
        id="mouse-interactive-surface"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
        className="mt-6 h-44 rounded-xl border-2 border-dashed border-[#CBD5E1] dark:border-[#31435D] bg-[#F8FAFC] dark:bg-[#0E1520] hover:border-[#0F766E] transition-colors flex flex-col items-center justify-center cursor-crosshair select-none p-4 text-center"
      >
        <Mouse className="w-8 h-8 text-[#0F766E] dark:text-[#14B8A6] mb-2 opacity-80" />
        <p className="text-sm font-medium text-[#142033] dark:text-[#E9EEF4]">
          {t.mouseTest.clickAreaPrompt}
        </p>
        <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
          Supports Left, Middle, and Right Clicks + Scroll Wheel (Context menu intercepted for testing)
        </p>
      </div>

      {/* Double-Click Timing Observer */}
      <div className="mt-6 p-4 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4]">
              {t.mouseTest.doubleClickTest}
            </h3>
            <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
              {t.mouseTest.observedDoubleClickTiming}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-num">
            <div>
              <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">Interval: </span>
              <span className="font-bold text-[#142033] dark:text-[#E9EEF4]">
                {lastIntervalMs !== null ? `${lastIntervalMs} ms` : '—'}
              </span>
            </div>

            <div>
              <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">Rapid Double-Clicks (&lt;80ms): </span>
              <span className={`font-bold ${fastDoubleClicks > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#0F766E] dark:text-[#14B8A6]'}`}>
                {fastDoubleClicks}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-[#8996A6] mt-3 italic">
        {t.mouseTest.latencyDisclaimer}
      </p>

      <div className="mt-6 pt-5 border-t border-[#DFE5EB] dark:border-[#223043] text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
          {t.mouseTest.interpretationTitle}
        </h3>
        <p className="leading-relaxed">{t.mouseTest.interpretationText}</p>
      </div>
    </div>
  );
}
