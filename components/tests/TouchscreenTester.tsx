'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function TouchscreenTester({ onResultUpdate }: ToolComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [touchedTiles, setTouchedTiles] = useState<Set<string>>(new Set());
  const [totalPoints, setTotalPoints] = useState<number>(0);
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

    // Grid background
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

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
          if (onResultUpdate) {
            const pct = Math.round((next.size / (rows * cols)) * 100);
            onResultUpdate('passed', `Screen coverage: ${pct}% (${next.size}/${rows * cols} tiles)`);
          }
          return next;
        });
      }
      setTotalPoints((p) => p + 1);
    }
  };

  const clearCanvas = () => {
    setTouchedTiles(new Set());
    setTotalPoints(0);
  };

  const coveragePercent = Math.round((touchedTiles.size / (rows * cols)) * 100);

  return (
    <div className="space-y-6">
      {/* Top statistics summary bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] uppercase font-semibold">
              Grid Coverage
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
              Raw Sample Points
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

      {/* Main Touch Canvas */}
      <div className="rounded-2xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden bg-white dark:bg-[#111D30] shadow-sm">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerMove}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') {
              handlePointerMove(e);
            }
          }}
          className="w-full h-[400px] touch-none cursor-crosshair block"
        />
      </div>
      <p className="text-center text-xs text-[#59677D] dark:text-[#9AA6B8]">
        Touch and drag across the screen surface to check capacitive digitizer continuity.
      </p>
    </div>
  );
}
