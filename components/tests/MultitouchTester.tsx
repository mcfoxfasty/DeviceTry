'use client';

import React, { useState, useRef } from 'react';
import { Layers, RotateCcw, Smartphone, CheckCircle } from 'lucide-react';
import { ToolComponentProps } from '@/lib/tools/registry';

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

export function MultitouchTester({ onResultUpdate }: ToolComponentProps) {
  const [activeTouches, setActiveTouches] = useState<TouchPoint[]>([]);
  const [maxObserved, setMaxObserved] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const points: TouchPoint[] = [];

    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      // Type-safe extraction for browser variations
      const rawTouch = t as unknown as { radiusX?: number; radiusY?: number; clientX: number; clientY: number; identifier: number };
      points.push({
        id: rawTouch.identifier,
        x: rawTouch.clientX - rect.left,
        y: rawTouch.clientY - rect.top,
        radiusX: rawTouch.radiusX || 24,
        radiusY: rawTouch.radiusY || 24,
      });
    }

    setActiveTouches(points);
    if (points.length > maxObserved) {
      setMaxObserved(points.length);
      if (onResultUpdate) {
        onResultUpdate('passed', `Max observed: ${points.length} simultaneous touches`);
      }
    }
  };

  const resetMax = () => {
    setMaxObserved(0);
    setActiveTouches([]);
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">Active Fingers</span>
            <p className="text-xl font-mono font-bold text-[#0F766E] dark:text-[#14B8A6]">
              {activeTouches.length}
            </p>
          </div>
          <div className="border-l border-[#DFE5EB] dark:border-[#223043] pl-4">
            <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">Max Simultaneous</span>
            <p className="text-xl font-mono font-bold text-[#172033] dark:text-[#E9EEF4]">
              {maxObserved}
            </p>
          </div>
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
        className="relative w-full h-80 sm:h-96 rounded-2xl bg-[#0F172A] border-2 border-dashed border-[#334155] touch-none select-none flex items-center justify-center overflow-hidden cursor-crosshair"
      >
        {activeTouches.length === 0 ? (
          <div className="text-center p-6 pointer-events-none">
            <Smartphone className="w-10 h-10 mx-auto text-[#64748B] mb-2 animate-bounce" />
            <p className="text-sm font-bold text-[#E2E8F0]">
              Place 2 to 10 Fingers on Screen
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Supports 10-point multitouch gesture testing
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
    </div>
  );
}
