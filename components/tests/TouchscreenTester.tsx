'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Hand, MousePointer2, PenTool } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import {
  pointerSourceOf,
  countsAsTouchInput,
  emptyTally,
  tallySource,
  TouchSourceTally,
} from '@/lib/testing/sensorGates';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function TouchscreenTester({ onResultUpdate }: ToolComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [touchedTiles, setTouchedTiles] = useState<Set<string>>(new Set());
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [sources, setSources] = useState<TouchSourceTally>(emptyTally());
  const rows = 10;
  const cols = 10;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / cols;
    const cellH = h / rows;

    ctx.clearRect(0, 0, w, h);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}-${c}`;
        const isHit = touchedTiles.has(key);
        ctx.fillStyle = isHit ? '#0F766E' : '#F6F8FB';
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

        ctx.strokeStyle = '#DFE5EB';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
  }, [touchedTiles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    redraw();
  }, [redraw]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const source = pointerSourceOf(e.pointerType);

    // Track what input sources were actually used (shown honestly in the UI).
    setSources((prev) => tallySource(prev, source));

    // Mouse movement NEVER establishes a touchscreen result: it is not
    // registered as coverage, only tallied. Pen is counted but visibly
    // separated from finger-touch in the UI.
    if (!countsAsTouchInput(source)) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellW = rect.width / cols;
    const cellH = rect.height / rows;

    const c = Math.floor(x / cellW);
    const r = Math.floor(y / cellH);

    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      const key = `${r}-${c}`;
      if (!touchedTiles.has(key)) {
        setTouchedTiles((prev) => {
          const next = new Set(prev);
          next.add(key);
          const pct = Math.round((next.size / (rows * cols)) * 100);
          const sourceNote = source === 'pen' ? ' (pen input — finger coverage may differ)' : '';
          onResultUpdate?.(
            'inconclusive',
            `Observed touch coverage: ${pct}% (${next.size}/${rows * cols} tiles)${sourceNote}. Partial coverage does not certify the whole screen — cover all regions and judge dead zones visually.`
          );
          return next;
        });
      }
      setTotalPoints((p) => p + 1);
    }
  };

  const clearCanvas = () => {
    setTouchedTiles(new Set());
    setTotalPoints(0);
    setSources(emptyTally());
  };

  const coveragePercent = Math.round((touchedTiles.size / (rows * cols)) * 100);
  const hasTouchInput = sources.touch > 0;
  const hasPenInput = sources.pen > 0;
  const hasMouseInput = sources.mouse > 0;

  return (
    <div className="space-y-6">
      {/* Top statistics summary bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] uppercase font-semibold">
              Touch Coverage
            </span>
            <div className="text-xl font-mono font-bold text-[#0F766E] dark:text-[#14B8A6]">
              {coveragePercent}%
            </div>
          </div>
          <div>
            <span className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] uppercase font-semibold">
              Covered Cells
            </span>
            <div className="text-xl font-mono font-bold text-[#172033] dark:text-[#E9EEF4]">
              {touchedTiles.size} / {rows * cols}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] uppercase font-semibold">
              Touch/Pen Points
            </span>
            <div className="text-xl font-mono font-bold text-[#172033] dark:text-[#E9EEF4]">
              {totalPoints}
            </div>
          </div>
        </div>

        <button
          onClick={clearCanvas}
          className="px-4 py-2 bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Grid
        </button>
      </div>

      {/* Input-source honesty panel */}
      <div className="p-3 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-[#142033] dark:text-[#E9EEF4]">
          <Hand className="w-4 h-4 text-[#0F766E]" />
          Touch events: {sources.touch}
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-[#142033] dark:text-[#E9EEF4]">
          <PenTool className="w-4 h-4 text-[#7C3AED]" />
          Pen events: {sources.pen}
          {hasPenInput && !hasTouchInput && (
            <em className="text-[10px] font-normal text-[#8996A6]">
              (pen detected — not finger-touch verification)
            </em>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-[#59677D] dark:text-[#9AA6B8]">
          <MousePointer2 className="w-4 h-4" />
          Mouse events (not counted): {sources.mouse}
        </span>
      </div>

      {/* Main Touch Canvas */}
      <div className="rounded-2xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden bg-white dark:bg-[#111D30] shadow-sm">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          className="w-full h-[400px] touch-none cursor-crosshair block"
        />
      </div>
      <p className="text-center text-xs text-[#59677D] dark:text-[#9AA6B8]">
        Touch and drag with a finger (or pen — counted separately) to check digitizer continuity. Mouse
        movement is deliberately ignored: a working mouse never proves a working touchscreen.
      </p>
      <p className="text-center text-[11px] text-[#8996A6]">
        {hasTouchInput || hasPenInput
          ? `Observed coverage is shown above — it reflects only the regions you actually touched.`
          : 'No touch or pen input observed yet.'}
      </p>
    </div>
  );
}
