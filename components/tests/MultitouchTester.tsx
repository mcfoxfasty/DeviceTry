'use client';

import React, { useState, useRef } from 'react';
import { RotateCcw, Smartphone, Info } from 'lucide-react';
import { ToolComponentProps } from '@/lib/tools/types';
import { ObservedTouchCounter, multitouchVerdict, MULTITOUCH_MIN_SIMULTANEOUS } from '@/lib/testing/sensorGates';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

const TOUCH_COLORS = [
  '#0F766E', // teal
  '#2563EB', // blue
  '#7C3AED', // purple
  '#DB2777', // pink
  '#DC2626', // red
  '#D97706', // amber
  '#059669', // emerald
  '#4F46E5', // indigo
  '#14B8A6', // cyan
  '#F59E0B', // orange
];

interface MultitouchTesterProps extends ToolComponentProps {
  /**
   * Host reset hook. Multi-Touch keeps its own verdict, so its Reset must clear
   * that verdict rather than leave a stale observation count on screen.
   */
  onResultClear?: () => void;
}

/**
 * Whether this browser can report simultaneous touches at all. Used only to
 * explain an absence of data — never to claim a pass.
 */
function canReportTouches(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
}

export function MultitouchTester({ onResultUpdate, onResultClear }: MultitouchTesterProps) {
  const [activeTouches, setActiveTouches] = useState<TouchPoint[]>([]);
  const [maxObserved, setMaxObserved] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Central bookkeeping for observed simultaneous touches (extracted + tested).
  const counterRef = useRef<ObservedTouchCounter>(new ObservedTouchCounter());
  // Guards the mouse handler so a drag emits one explanation, not a stream.
  const mouseExplainedRef = useRef<boolean>(false);

  /**
   * Emit the verdict derived from what was actually observed. The rules live in
   * `multitouchVerdict` so they are unit-testable; this only feeds it the tally.
   */
  const publish = (overrides: { mouseInput?: boolean; unsupportedObservation?: boolean } = {}) => {
    const verdict = multitouchVerdict({
      observed: counterRef.current.maxSimultaneousObserved,
      ...overrides,
    });
    onResultUpdate?.(verdict.status, verdict.details);
  };

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const points: TouchPoint[] = [];

    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      const rawTouch = t as unknown as { radiusX?: number; radiusY?: number; clientX: number; clientY: number; identifier: number };
      points.push({
        id: rawTouch.identifier,
        x: rawTouch.clientX - rect.left,
        y: rawTouch.clientY - rect.top,
        radiusX: rawTouch.radiusX || 24,
        radiusY: rawTouch.radiusY || 24,
      });
    }

    counterRef.current.observe(points.length);
    setActiveTouches(points);

    const observed = counterRef.current.maxSimultaneousObserved;
    if (observed > maxObserved) {
      setMaxObserved(observed);
      // Re-derived every time the high-water mark rises: two or more genuine
      // points at once is the evidence of multi-touch. It previously reported
      // a hard-coded inconclusive, so a real multi-finger observation could
      // never pass.
      publish();
    }
  };

  /**
   * A mouse is a single contact by definition and must never pass. It is
   * reported explicitly rather than ignored, so a desktop user learns why
   * nothing happened instead of seeing a silent, unchanged card.
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (mouseExplainedRef.current) return;
    mouseExplainedRef.current = true;
    publish({ mouseInput: true });
  };

  /** Nothing observed yet — report the guidance, never a silent pass. */
  const handlePadEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (counterRef.current.maxSimultaneousObserved === 0) {
      publish({ unsupportedObservation: !canReportTouches() });
    }
  };

  const resetMax = () => {
    counterRef.current.reset();
    setMaxObserved(0);
    setActiveTouches([]);
    mouseExplainedRef.current = false;
    // Clear this tab's own verdict — independent of the coverage tab's.
    onResultClear?.();
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">Active Touches</span>
            <p className="text-xl font-mono font-bold text-[#0F766E] dark:text-[#14B8A6]">
              {activeTouches.length}
            </p>
          </div>
          <div className="border-l border-[#DFE5EB] dark:border-[#223043] pl-4">
            <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">Max Observed (this session)</span>
            <p className="text-xl font-mono font-bold text-[#172033] dark:text-[#E9EEF4]">
              {maxObserved}
            </p>
          </div>
        </div>

        {/* Clear, plain readout of the simultaneous-touch observation, so the
            number is not buried in the result details. */}
        <div className="text-right">
          <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">
            Simultaneous genuine touch points
          </span>
          <p
            className={`text-sm font-mono font-bold ${
              maxObserved >= MULTITOUCH_MIN_SIMULTANEOUS
                ? 'text-[#0F766E] dark:text-[#14B8A6]'
                : 'text-[#59677D] dark:text-[#9AA6B8]'
            }`}
          >
            {maxObserved} at once
          </p>
        </div>

        <button
          onClick={resetMax}
          className="px-3 py-1.5 rounded-lg border border-[#DFE5EB] dark:border-[#223043] hover:bg-slate-50 dark:hover:bg-[#192332] text-xs font-semibold text-[#172033] dark:text-[#E9EEF4] flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Counter
        </button>
      </div>

      {/* Multitouch Interactive Pad */}
      <div
        ref={containerRef}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={handleTouch}
        onTouchCancel={handleTouch}
        // Mouse is a single contact by definition; it is reported honestly
        // rather than ignored. Genuine touches skip it entirely.
        onPointerDown={handlePointerDown}
        // With nothing observed yet, entering the pad explains the idle state
        // instead of leaving a silent, unexplained card.
        onPointerEnter={handlePadEnter}
        className="relative w-full h-80 sm:h-96 rounded-2xl bg-[#0F172A] border-2 border-dashed border-[#334155] touch-none overscroll-contain select-none flex items-center justify-center overflow-hidden cursor-crosshair"
      >
        {activeTouches.length === 0 ? (
          <div className="text-center p-6 pointer-events-none">
            <Smartphone className="w-10 h-10 mx-auto text-[#64748B] mb-2 animate-bounce" />
            <p className="text-sm font-bold text-[#E2E8F0]">
              Place multiple fingers on the screen
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              The counter reports how many simultaneous touches were OBSERVED — the display may register fewer or more than this session shows.
            </p>
          </div>
        ) : null}

        {/* Live Touch Rings */}
        {activeTouches.map((touch, idx) => {
          const color = TOUCH_COLORS[idx % TOUCH_COLORS.length];
          return (
            <div
              key={touch.id}
              style={{
                left: `${touch.x}px`,
                top: `${touch.y}px`,
                transform: 'translate(-50%, -50%)',
                borderColor: color,
                backgroundColor: `${color}33`,
              }}
              className="absolute w-20 h-20 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform pointer-events-none"
            >
              <div
                style={{ backgroundColor: color }}
                className="w-4 h-4 rounded-full text-white font-mono font-bold text-[9px] flex items-center justify-center shadow-sm"
              >
                {idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Honesty note */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          &quot;Max observed&quot; is the highest simultaneous touch count seen in THIS session. Browsers do not
          expose a device&apos;s hardware touch-point limit, so no maximum is claimed or inferred.
        </span>
      </div>
    </div>
  );
}
