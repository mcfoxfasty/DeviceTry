'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mouse, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function MousePollingRateTester({ onResultUpdate }: ToolComponentProps) {
  const [currentRate, setCurrentRate] = useState<number>(0);
  const [maxRate, setMaxRate] = useState<number>(0);
  const [avgRate, setAvgRate] = useState<number>(0);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);

  const eventsCountRef = useRef<number>(0);
  const samplesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0); // set when measurement starts, before any elapsed math uses it
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startMeasuring = useCallback(() => {
    setIsMeasuring(true);
    eventsCountRef.current = 0;
    lastTimeRef.current = performance.now();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = performance.now();
      const elapsedSec = (now - lastTimeRef.current) / 1000;
      if (elapsedSec > 0) {
        const rate = Math.round(eventsCountRef.current / elapsedSec);
        if (eventsCountRef.current > 0) {
          setCurrentRate(rate);
          samplesRef.current.push(rate);
          if (samplesRef.current.length > 50) samplesRef.current.shift();

          const sum = samplesRef.current.reduce((a, b) => a + b, 0);
          const avg = Math.round(sum / samplesRef.current.length);
          setAvgRate(avg);

          setMaxRate((m) => Math.max(m, rate));
          setSampleCount((c) => c + eventsCountRef.current);

          if (onResultUpdate) {
            onResultUpdate('passed', `Current: ${rate} Hz • Peak: ${Math.max(rate, avg)} Hz`);
          }
        } else {
          setCurrentRate(0);
        }
      }
      eventsCountRef.current = 0;
      lastTimeRef.current = now;
    }, 100);
  }, [onResultUpdate]);

  const handlePointerMove = () => {
    if (!isMeasuring) {
      startMeasuring();
    }
    eventsCountRef.current += 1;
  };

  const resetMetrics = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsMeasuring(false);
    setCurrentRate(0);
    setMaxRate(0);
    setAvgRate(0);
    setSampleCount(0);
    samplesRef.current = [];
    eventsCountRef.current = 0;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] text-center">
          <span className="text-[11px] font-bold text-[#59677D] dark:text-[#9AA6B8] uppercase">
            Current Rate
          </span>
          <div className="text-3xl font-mono font-black text-[#0F766E] dark:text-[#14B8A6] mt-1">
            {currentRate} <span className="text-sm">Hz</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] text-center">
          <span className="text-[11px] font-bold text-[#59677D] dark:text-[#9AA6B8] uppercase">
            Peak Rate
          </span>
          <div className="text-3xl font-mono font-black text-[#172033] dark:text-[#E9EEF4] mt-1">
            {maxRate} <span className="text-sm">Hz</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] text-center">
          <span className="text-[11px] font-bold text-[#59677D] dark:text-[#9AA6B8] uppercase">
            Average Rate
          </span>
          <div className="text-3xl font-mono font-black text-[#172033] dark:text-[#E9EEF4] mt-1">
            {avgRate} <span className="text-sm">Hz</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] text-center flex flex-col items-center justify-center">
          <button
            onClick={resetMetrics}
            className="px-3.5 py-2 bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Data
          </button>
        </div>
      </div>

      {/* Main Movement Target Pad */}
      <div
        onMouseMove={handlePointerMove}
        className="w-full h-[360px] rounded-2xl border-2 border-dashed border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] bg-white dark:bg-[#111D30] flex flex-col items-center justify-center text-center p-8 select-none cursor-crosshair transition-colors"
      >
        <div className="space-y-3 pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] flex items-center justify-center mx-auto">
            <Mouse className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-[#172033] dark:text-[#E9EEF4]">
            Move Cursor Continuously in This Box
          </h3>
          <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] max-w-sm mx-auto">
            Move your mouse in quick continuous circles to measure polling frequency (125Hz, 500Hz, 1000Hz+).
          </p>
        </div>
      </div>
    </div>
  );
}
