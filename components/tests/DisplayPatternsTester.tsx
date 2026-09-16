'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

type PatternType = 'grayscale-steps' | 'gamma-gradient' | 'black-level' | 'white-level' | 'checkerboard' | 'sharpness';

export function DisplayPatternsTester({ onResultUpdate }: ToolComponentProps) {
  const [pattern, setPattern] = useState<PatternType>('grayscale-steps');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawPattern = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (pattern === 'grayscale-steps') {
      const steps = 16;
      const stepW = w / steps;
      for (let i = 0; i < steps; i++) {
        const val = Math.round((i / (steps - 1)) * 255);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(i * stepW, 0, stepW, h);

        ctx.fillStyle = val > 128 ? '#000000' : '#FFFFFF';
        ctx.font = '12px monospace';
        ctx.fillText(`${Math.round((i / (steps - 1)) * 100)}%`, i * stepW + 8, h - 20);
      }
    } else if (pattern === 'gamma-gradient') {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (pattern === 'black-level') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const boxes = [1, 2, 3, 4, 6, 8, 12, 16];
      const boxW = w / (boxes.length + 1);
      boxes.forEach((b, idx) => {
        ctx.fillStyle = `rgb(${b},${b},${b})`;
        ctx.fillRect((idx + 0.5) * boxW, h / 2 - 40, boxW - 10, 80);
        ctx.fillStyle = '#666666';
        ctx.font = '10px monospace';
        ctx.fillText(`RGB ${b}`, (idx + 0.5) * boxW + 4, h / 2 + 60);
      });
    } else if (pattern === 'white-level') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      const boxes = [254, 253, 252, 250, 248, 244, 240];
      const boxW = w / (boxes.length + 1);
      boxes.forEach((b, idx) => {
        ctx.fillStyle = `rgb(${b},${b},${b})`;
        ctx.fillRect((idx + 0.5) * boxW, h / 2 - 40, boxW - 10, 80);
        ctx.fillStyle = '#999999';
        ctx.font = '10px monospace';
        ctx.fillText(`RGB ${b}`, (idx + 0.5) * boxW + 4, h / 2 + 60);
      });
    } else if (pattern === 'checkerboard') {
      const size = 32;
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          const isEven = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
          ctx.fillStyle = isEven ? '#000000' : '#FFFFFF';
          ctx.fillRect(x, y, size, size);
        }
      }
    } else if (pattern === 'sharpness') {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
  }, [pattern]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    drawPattern();
    if (onResultUpdate) {
      onResultUpdate('passed', `Rendered calibration pattern: ${pattern}`);
    }
  }, [drawPattern, pattern, onResultUpdate]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pattern Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'grayscale-steps', label: '16 Grayscale Steps' },
              { id: 'gamma-gradient', label: 'Smooth Gradient' },
              { id: 'black-level', label: 'Black Level / Contrast' },
              { id: 'white-level', label: 'White Level / Highlights' },
              { id: 'checkerboard', label: 'Uniform Checkerboard' },
              { id: 'sharpness', label: 'Pixel Grid Sharpness' },
            ] as { id: PatternType; label: string }[]
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPattern(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                pattern === p.id
                  ? 'bg-[#0F766E] text-white border-[#0D665F]'
                  : 'bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={toggleFullscreen}
          className="px-3 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          {isFullscreen ? 'Exit Fullscreen' : 'Launch Fullscreen'}
        </button>
      </div>

      {/* Main Canvas Viewport */}
      <div className="rounded-2xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden bg-black shadow-sm">
        <canvas ref={canvasRef} className="w-full h-[400px] block" />
      </div>
    </div>
  );
}
