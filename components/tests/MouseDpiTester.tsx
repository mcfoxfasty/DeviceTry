'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mouse, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function MouseDpiTester({ onResultUpdate }: ToolComponentProps) {
  const [targetDistanceInches, setTargetDistanceInches] = useState<number>(2);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [totalPixelsMoved, setTotalPixelsMoved] = useState<number>(0);
  const [calculatedDpi, setCalculatedDpi] = useState<number>(0);
  const startXRef = useRef<number | null>(null);

  const startMeasurement = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsMeasuring(true);
    startXRef.current = e.clientX;
    setTotalPixelsMoved(0);
    setCalculatedDpi(0);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMeasuring || startXRef.current === null) return;
    const delta = Math.abs(e.clientX - startXRef.current);
    setTotalPixelsMoved(delta);
    if (targetDistanceInches > 0) {
      const dpi = Math.round(delta / targetDistanceInches);
      setCalculatedDpi(dpi);
    }
  };

  const endMeasurement = () => {
    if (!isMeasuring) return;
    setIsMeasuring(false);
    if (onResultUpdate && calculatedDpi > 0) {
      onResultUpdate('passed', `Estimated DPI: ~${calculatedDpi} DPI (${totalPixelsMoved}px across ${targetDistanceInches}")`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Target distance configuration */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">Ruler Distance:</span>
          {[1, 2, 3, 5].map((inch) => (
            <button
              key={inch}
              onClick={() => {
                setTargetDistanceInches(inch);
                setCalculatedDpi(0);
                setTotalPixelsMoved(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                targetDistanceInches === inch
                  ? 'bg-[#0F766E] text-white border-[#0D665F]'
                  : 'bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
              }`}
            >
              {inch} inch{inch > 1 ? 'es' : ''} ({Math.round(inch * 2.54)} cm)
            </button>
          ))}
        </div>

        <div className="text-xs text-[#59677D] dark:text-[#9AA6B8]">
          Physical target: Move mouse exactly {targetDistanceInches}&quot; across mousepad
        </div>
      </div>

      {/* Stats display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] text-center">
          <span className="text-[11px] font-bold text-[#59677D] dark:text-[#9AA6B8] uppercase">
            Estimated DPI
          </span>
          <div className="text-5xl font-mono font-black text-[#0F766E] dark:text-[#14B8A6] my-2">
            {calculatedDpi} <span className="text-xl font-normal">DPI</span>
          </div>
          <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">
            {totalPixelsMoved} pixels moved
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col justify-center text-xs text-[#59677D] dark:text-[#9AA6B8] space-y-2">
          <p className="font-semibold text-[#172033] dark:text-[#E9EEF4]">How to test accurately:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Place a physical ruler on your mousepad.</li>
            <li>Press and hold mouse button at the left marker.</li>
            <li>Drag straight right until mouse body moves exactly {targetDistanceInches}&quot;.</li>
            <li>Release mouse button to compute sensor DPI.</li>
          </ol>
        </div>
      </div>

      {/* Main Drag Surface */}
      <div
        onMouseDown={startMeasurement}
        onMouseMove={handleMouseMove}
        onMouseUp={endMeasurement}
        className={`w-full h-[300px] rounded-2xl border-2 flex flex-col items-center justify-center text-center p-8 select-none cursor-ew-resize transition-all ${
          isMeasuring
            ? 'border-[#0F766E] bg-[#E6F4F2]/30 dark:bg-[#133230]/40'
            : 'border-dashed border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#111D30] hover:border-[#0F766E]'
        }`}
      >
        <div className="space-y-3 pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] flex items-center justify-center mx-auto">
            <Mouse className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-[#172033] dark:text-[#E9EEF4]">
            {isMeasuring ? 'Dragging... Move Exactly Across Ruler' : 'Click & Hold to Measure DPI'}
          </h3>
          <p className="text-xs text-[#59677D] dark:text-[#9AA6B8]">
            Release mouse click when you have moved {targetDistanceInches} inches on your desk.
          </p>
        </div>
      </div>
    </div>
  );
}
