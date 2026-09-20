'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function MotionBlurTester({ onResultUpdate }: ToolComponentProps) {
  const [speed, setSpeed] = useState<number>(960); // pixels per second
  const [showSyncBars, setShowSyncBars] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const posRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0); // timestamp set when the animation starts

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    lastTimeRef.current = performance.now(); // pure here: inside the effect

    // Self-scheduling frame loop, declared INSIDE the effect so it closes over
    // speed/showSyncBars directly — no self-referencing useCallback needed.
    const renderFrame = () => {
      const now = performance.now();
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);

      // Update position
      posRef.current = (posRef.current + speed * dt) % (w + 100);
      const x = posRef.current - 50;

      // Track 1: Moving UFO-style high-contrast saucers
      const rowY1 = h * 0.28;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, rowY1 - 40, w, 80);

      // Saucer body
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.ellipse(x, rowY1, 35, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Saucer dome & eyes
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(x, rowY1 - 8, 14, Math.PI, 0);
      ctx.fill();

      // Track 2: Pinstripe vertical bars for ghosting / overdrive overshoot
      const rowY2 = h * 0.72;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, rowY2 - 40, w, 80);

      if (showSyncBars) {
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#EF4444';
          ctx.fillRect(x - 30 + i * 8, rowY2 - 25, 5, 50);
        }
      } else {
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(x - 30, rowY2 - 25, 60, 50);
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    };

    rafRef.current = requestAnimationFrame(renderFrame);
    if (onResultUpdate) {
      onResultUpdate('passed', `Motion ghosting pattern moving at ${speed} px/sec`);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [speed, showSyncBars, onResultUpdate]);

  return (
    <div className="space-y-6">
      {/* Configuration bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#59677D] dark:text-[#9AA6B8]">Motion Velocity:</span>
          {[480, 960, 1440, 1920].map((px) => (
            <button
              key={px}
              onClick={() => setSpeed(px)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                speed === px
                  ? 'bg-[#0F766E] text-white border-[#0D665F]'
                  : 'bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
              }`}
            >
              {px} px/s
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSyncBars(!showSyncBars)}
          className="px-3.5 py-1.5 bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-xl text-xs font-semibold cursor-pointer"
        >
          {showSyncBars ? 'Pinstripes Mode' : 'Solid Block Mode'}
        </button>
      </div>

      {/* Main High-Speed Motion Canvas */}
      <div className="rounded-2xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden bg-[#0F172A] shadow-sm">
        <canvas ref={canvasRef} className="w-full h-[360px] block" />
      </div>

      <p className="text-center text-xs text-[#59677D] dark:text-[#9AA6B8]">
        Track the moving shapes with your eyes to inspect pixel response time, ghosting, and inverse overdrive trailing.
      </p>
    </div>
  );
}
