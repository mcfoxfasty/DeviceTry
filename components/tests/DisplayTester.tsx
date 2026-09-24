'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Maximize, CheckCircle, AlertTriangle, Eye, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';

interface DisplayTesterProps {
  t: Translations;
  onRecordResult?: (result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured'; details: string; metrics?: Record<string, unknown> }) => void;
  onResultClear?: () => void;
}

type PatternType = 'red' | 'green' | 'blue' | 'white' | 'black' | 'gray' | 'gradient' | 'grid';

export function DisplayTester({ t, onRecordResult, onResultClear }: DisplayTesterProps) {
  const [selectedPattern, setSelectedPattern] = useState<PatternType>('white');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [measuredHz, setMeasuredHz] = useState<number | null>(null);
  const [userObservation, setUserObservation] = useState<'clean' | 'pixels_found' | 'bleed_found' | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // In-card verdict banner — forwards to the guided-inspection report as before.
  const { result, emit, clear, reset, startRun, invalidate } = useTestResult({
    onRecordResult,
    onResultClear,
  });
  const emitRef = useRef(emit);

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  // Unmount: invalidate in-flight emissions without deleting a completed
  // guided result.
  useEffect(() => {
    return () => {
      invalidate();
    };
  }, [invalidate]);

  // Measure browser display refresh rate accurately
  useEffect(() => {
    let frameCount = 0;
    let startTime = performance.now();
    let animId: number;

    const measure = (now: number) => {
      frameCount++;
      const elapsed = now - startTime;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        setMeasuredHz(fps);
        frameCount = 0;
        startTime = now;
      }

      animId = requestAnimationFrame(measure);
    };

    animId = requestAnimationFrame(measure);

    return () => cancelAnimationFrame(animId);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not permitted in some iframe environments
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const recordObservation = (obs: 'clean' | 'pixels_found' | 'bleed_found') => {
    setUserObservation(obs);
    const passed = obs === 'clean';
    // Direct emission: the controller dedupes; a real observation change has
    // different details/metrics and forwards once.
    emitRef.current(
      passed ? 'passed' : 'warning',
      `User visual observation: ${obs}. Measured Refresh Rate: ${measuredHz}Hz`,
      { observation: obs, measuredRefreshRateHz: measuredHz }
    );
  };

  /** Clear the observation and the verdict: starting over must not keep the
   *  previous run's result. One lifecycle transition — startRun clears the
   *  visible verdict and the host/guided result exactly once. */
  const startNewTest = () => {
    setUserObservation(null);
    startRun();
  };

  const getPatternBgClass = (pattern: PatternType) => {
    switch (pattern) {
      case 'red':
        return 'bg-[#FF0000]';
      case 'green':
        return 'bg-[#00FF00]';
      case 'blue':
        return 'bg-[#0000FF]';
      case 'white':
        return 'bg-[#FFFFFF]';
      case 'black':
        return 'bg-[#000000]';
      case 'gray':
        return 'bg-[#808080]';
      case 'gradient':
        return 'bg-gradient-to-r from-black via-gray-500 to-white';
      case 'grid':
        return 'bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:16px_16px] bg-white';
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.displayTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.displayTest.shortDesc}</p>
        </div>

        <div className="flex items-center gap-3">
          {measuredHz && (
            <div className="text-xs bg-[#F6F7F9] dark:bg-[#192332] px-3 py-1.5 rounded border border-[#DFE5EB] dark:border-[#223043] font-mono-num">
              <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">Refresh: </span>
              <span className="font-bold text-[#142033] dark:text-[#E9EEF4]"><bdi>{measuredHz} Hz</bdi></span>
            </div>
          )}

          <button
            id="btn-fullscreen-display"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            <Maximize className="w-3.5 h-3.5" />
            {isFullscreen ? t.displayTest.exitFullscreen : t.displayTest.launchFullscreen}
          </button>
        </div>
      </div>

      {/* Pattern Selector Chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(['white', 'black', 'red', 'green', 'blue', 'gray', 'gradient', 'grid'] as PatternType[]).map((pattern) => (
          <button
            key={pattern}
            onClick={() => setSelectedPattern(pattern)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer capitalize flex items-center gap-1.5 ${
              selectedPattern === pattern
                ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-sm'
                : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            {pattern}
          </button>
        ))}
      </div>

      {/* Display Test Canvas Container */}
      <div
        ref={containerRef}
        className={`mt-6 h-64 sm:h-80 w-full rounded-xl border border-[#DFE5EB] dark:border-[#223043] transition-colors relative flex items-center justify-center cursor-pointer overflow-hidden ${getPatternBgClass(
          selectedPattern
        )}`}
        onClick={() => {
          // cycle pattern on click
          const patterns: PatternType[] = ['white', 'black', 'red', 'green', 'blue', 'gray', 'gradient', 'grid'];
          const nextIdx = (patterns.indexOf(selectedPattern) + 1) % patterns.length;
          setSelectedPattern(patterns[nextIdx]);
        }}
      >
        <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs pointer-events-none opacity-80 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" />
          <span>Click to cycle test pattern (Pattern: {selectedPattern})</span>
        </div>
      </div>

      {/* Visual Observation Feedback */}
      <div className="mt-6 p-4 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
        <p className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4] mb-3">
          {t.displayTest.userConfirmObservation}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => recordObservation('clean')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
              userObservation === 'clean'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {t.displayTest.noDeadPixelsFound}
          </button>

          <button
            onClick={() => recordObservation('pixels_found')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
              userObservation === 'pixels_found'
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {t.displayTest.deadPixelsObserved}
          </button>

          <button
            onClick={() => recordObservation('bleed_found')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
              userObservation === 'bleed_found'
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {t.displayTest.uniformityIssues}
          </button>
        </div>
      </div>

      {/* Clear observation + verdict so a new run never shows the old result */}
      {userObservation !== null && (
        <button
          onClick={startNewTest}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#E6F4F2] text-[#142033] dark:text-[#E9EEF4] text-xs font-medium rounded-md border border-[#DFE5EB] dark:border-[#223043] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Start New Test
        </button>
      )}

      {/* Test result — in-card, directly under the test + observation area */}
      <TestResultBanner result={result} onClear={clear} />

      <p className="text-[11px] text-[#8996A6] mt-3 italic">
        {t.displayTest.refreshRateNotice}
      </p>

      {/* Troubleshooting and Interpretation */}
      <div className="mt-6 pt-5 border-t border-[#DFE5EB] dark:border-[#223043] text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
          {t.displayTest.deadPixelCheck}
        </h3>
        <p className="leading-relaxed">{t.displayTest.cycleInstruction}</p>
      </div>
    </div>
  );
}
