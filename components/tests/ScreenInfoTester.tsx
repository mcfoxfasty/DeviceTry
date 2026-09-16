'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Ruler, Palette, Layers } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface ScreenSnapshot {
  viewportW: number;
  viewportH: number;
  screenW: number;
  screenH: number;
  availW: number;
  availH: number;
  dpr: number;
  physicalW: number;
  physicalH: number;
  colorDepth: number;
  pixelDepth: number;
  orientation: string;
  hdrSupported: boolean;
  wideGamut: boolean;
}

export function ScreenInfoTester({ onResultUpdate }: TesterProps) {
  const [snapshot, setSnapshot] = useState<ScreenSnapshot | null>(null);

  const measure = useCallback(() => {
    const s = window.screen;
    const dpr = window.devicePixelRatio || 1;
    const data: ScreenSnapshot = {
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      screenW: s.width,
      screenH: s.height,
      availW: s.availWidth,
      availH: s.availHeight,
      dpr,
      physicalW: Math.round(s.width * dpr),
      physicalH: Math.round(s.height * dpr),
      colorDepth: s.colorDepth,
      pixelDepth: s.pixelDepth,
      orientation: s.orientation?.type || 'unknown',
      hdrSupported: window.matchMedia('(dynamic-range: high)').matches,
      wideGamut: window.matchMedia('(color-gamut: p3)').matches,
    };
    setSnapshot(data);
    onResultUpdate?.('passed', `Logical ${data.screenW}x${data.screenH} @ ${dpr}x DPR (physical ~${data.physicalW}x${data.physicalH})`);
  }, [onResultUpdate]);

  useEffect(() => {
    let raf = requestAnimationFrame(measure);
    let resizeRaf: number | null = null;
    const onResize = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      window.removeEventListener('resize', onResize);
    };
  }, [measure]);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
          <Monitor className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Screen &amp; Display Specs</h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Live readout of window.screen and devicePixelRatio properties</p>
        </div>
      </div>

      {snapshot ? (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <div className="flex items-center gap-1.5 font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider mb-2">
              <Ruler className="w-3.5 h-3.5" /> Viewport (CSS px)
            </div>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4]">
              {snapshot.viewportW} × {snapshot.viewportH}
            </p>
            <p className="text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">Resizable window content area</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <div className="flex items-center gap-1.5 font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider mb-2">
              <Layers className="w-3.5 h-3.5" /> Logical Resolution
            </div>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4]">
              {snapshot.screenW} × {snapshot.screenH}
            </p>
            <p className="text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
              Available: {snapshot.availW} × {snapshot.availH} • {snapshot.orientation}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <div className="flex items-center gap-1.5 font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider mb-2">
              <Layers className="w-3.5 h-3.5" /> Device Pixel Ratio
            </div>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4]">
              {snapshot.dpr}× <span className="text-sm font-medium">→ physical ~{snapshot.physicalW} × {snapshot.physicalH}</span>
            </p>
            <p className="text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">Estimated physical canvas resolution</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <div className="flex items-center gap-1.5 font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider mb-2">
              <Palette className="w-3.5 h-3.5" /> Color Capabilities
            </div>
            <p className="font-mono-num text-lg font-bold text-[#142033] dark:text-[#E9EEF4]">
              {snapshot.colorDepth}-bit <span className="text-sm font-medium">({snapshot.pixelDepth}-bit pixel)</span>
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${snapshot.hdrSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                {snapshot.hdrSupported ? 'HDR High Range' : 'SDR Only'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${snapshot.wideGamut ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                {snapshot.wideGamut ? 'P3 Wide Gamut' : 'sRGB Gamut'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          Reading display properties…
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        Physical resolution is computed from logical resolution × devicePixelRatio. Browser page zoom and OS scaling (125%, 150%) affect these figures — press Ctrl+0 / Cmd+0 for a 1:1 reading.
      </div>
    </div>
  );
}
