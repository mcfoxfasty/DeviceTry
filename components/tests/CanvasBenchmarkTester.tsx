'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Palette, Play, Loader2 } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface BenchResult {
  frames: number;
  avgFps: number;
  score: number;
  particles: number;
  durationMs: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

const DURATION_MS = 5000;

export function CanvasBenchmarkTester({ onResultUpdate }: TesterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const [result, setResult] = useState<BenchResult | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startBenchmark = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onResultUpdate?.('unsupported', 'Canvas 2D context unavailable');
      return;
    }

    setResult(null);
    setRunning(true);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const w = canvas.width;
    const h = canvas.height;

    const particleCount = 900;
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 260 * dpr,
      vy: (Math.random() - 0.5) * 260 * dpr,
      r: (1.5 + Math.random() * 3) * dpr,
      hue: 160 + Math.random() * 60,
    }));

    const frameTimes: number[] = [];
    const start = performance.now();
    let last = start;

    const loop = () => {
      const now = performance.now();
      frameTimes.push(now - last);
      last = now;

      ctx.fillStyle = '#0B111A';
      ctx.fillRect(0, 0, w, h);

      // Particle physics pass
      for (const p of particles) {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // Geometry fill pass: rotating squares
      const t = (now - start) / 1000;
      for (let i = 0; i < 24; i++) {
        const size = (12 + i * 4) * dpr;
        const cx = w / 2 + Math.cos(t * (0.6 + i * 0.05)) * w * 0.3;
        const cy = h / 2 + Math.sin(t * (0.8 + i * 0.04)) * h * 0.3;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t + i);
        ctx.fillStyle = `hsla(${170 + i * 4}, 65%, 45%, 0.25)`;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }

      // Particle draw pass
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue}, 70%, 55%)`;
        ctx.fill();
      }

      const elapsed = now - start;
      if (elapsed > 250) {
        setLiveFps(Math.round((frameTimes.length / elapsed) * 1000));
      }

      if (elapsed < DURATION_MS) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
        const frames = frameTimes.length;
        const avgFrameMs = frameTimes.reduce((a, b) => a + b, 0) / frames;
        const avgFps = Math.round(1000 / avgFrameMs);
        const score = Math.round(avgFps * 10 + frames / 10);
        const res: BenchResult = { frames, avgFps, score, particles: particleCount, durationMs: Math.round(elapsed) };
        setResult(res);
        setRunning(false);
        setLiveFps(null);
        onResultUpdate?.('passed', `2D benchmark score ${score} — avg ${avgFps} FPS over ${frames} frames`);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Canvas 2D Rendering Benchmark</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">5-second particle physics and geometry fill workload</p>
          </div>
        </div>
        <button
          onClick={startBenchmark}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? `Running… ${liveFps ?? ''} FPS` : 'Start Benchmark'}
        </button>
      </div>

      <div className="mt-5 rounded-xl overflow-hidden border border-[#DFE5EB] dark:border-[#223043] bg-[#0B111A]">
        <canvas ref={canvasRef} className="w-full h-[300px] block" />
      </div>

      {result && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">2D Score</p>
            <p className="font-mono-num text-2xl font-black text-[#0F766E] dark:text-[#14B8A6] mt-1">{result.score}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Avg FPS</p>
            <p className="font-mono-num text-2xl font-black text-[#142033] dark:text-[#E9EEF4] mt-1">{result.avgFps}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Frames</p>
            <p className="font-mono-num text-2xl font-black text-[#142033] dark:text-[#E9EEF4] mt-1">{result.frames}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">Particles</p>
            <p className="font-mono-num text-2xl font-black text-[#142033] dark:text-[#E9EEF4] mt-1">{result.particles}</p>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        Scores reflect local CPU/GPU 2D acceleration and current tab priority — close heavy background tabs for reliable numbers. Results never leave your device.
      </div>
    </div>
  );
}
