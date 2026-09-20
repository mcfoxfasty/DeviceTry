'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function ColorCycleTester({ onResultUpdate }: ToolComponentProps) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(1000);
  const [cycleIndex, setCycleIndex] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const colors = useMemo(
    () => [
      '#FF0000', // Red
      '#00FF00', // Green
      '#0000FF', // Blue
      '#FFFF00', // Yellow
      '#00FFFF', // Cyan
      '#FF00FF', // Magenta
      '#FFFFFF', // White
      '#000000', // Black
    ],
    []
  );

  const stopCycle = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRunning(false);
  }, []);

  const startCycle = useCallback(() => {
    stopCycle();
    setIsRunning(true);
    timerRef.current = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % colors.length);
    }, speedMs);

    if (onResultUpdate) {
      onResultUpdate('passed', `Color cycling running at ${speedMs}ms interval`);
    }
  }, [speedMs, stopCycle, onResultUpdate, colors]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Displayed color is derived from the cycle index — no sync state/effect needed.
  const currentColor = colors[cycleIndex] ?? '#FF0000';

  return (
    <div className="space-y-6">
      {/* Control Configuration Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">Interval Speed:</span>
          {[200, 500, 1000, 2000].map((ms) => (
            <button
              key={ms}
              onClick={() => setSpeedMs(ms)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                speedMs === ms
                  ? 'bg-[#0F766E] text-white border-[#0D665F]'
                  : 'bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
              }`}
            >
              {ms}ms
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={startCycle}
              className="px-5 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Start Cycle
            </button>
          ) : (
            <button
              onClick={stopCycle}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              Stop Cycle
            </button>
          )}
        </div>
      </div>

      {/* Main Color Chamber Canvas */}
      <div
        className="w-full h-[400px] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] transition-colors duration-200 flex flex-col items-center justify-center text-center p-6 shadow-sm"
        style={{ backgroundColor: currentColor }}
      >
        <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md text-white font-mono text-sm font-bold shadow-lg">
          Color {cycleIndex + 1} / {colors.length} • {currentColor}
        </div>
      </div>
    </div>
  );
}
