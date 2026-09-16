'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Maximize, Minimize, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

const COLORS = [
  { name: 'Pure Red', hex: '#FF0000', textLight: true },
  { name: 'Pure Green', hex: '#00FF00', textLight: false },
  { name: 'Pure Blue', hex: '#0000FF', textLight: true },
  { name: 'Pure White', hex: '#FFFFFF', textLight: false },
  { name: 'Deep Black', hex: '#000000', textLight: true },
  { name: '50% Neutral Gray', hex: '#808080', textLight: true },
  { name: 'Pure Yellow', hex: '#FFFF00', textLight: false },
  { name: 'Pure Cyan', hex: '#00FFFF', textLight: false },
  { name: 'Pure Magenta', hex: '#FF00FF', textLight: true },
];

export function DeadPixelTester({ onResultUpdate }: ToolComponentProps) {
  const [colorIndex, setColorIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const nextColor = useCallback(() => {
    setColorIndex((c) => (c + 1) % COLORS.length);
  }, []);

  const prevColor = useCallback(() => {
    setColorIndex((c) => (c - 1 + COLORS.length) % COLORS.length);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        nextColor();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevColor();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nextColor, prevColor]);

  const activeColor = COLORS[colorIndex];

  return (
    <div className="space-y-6">
      {/* Test viewport preview area */}
      <div
        onClick={nextColor}
        className={`relative w-full rounded-2xl border border-[#DFE5EB] dark:border-[#223043] transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-between p-6 ${
          isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none h-screen' : 'h-[440px]'
        }`}
        style={{ backgroundColor: activeColor.hex }}
      >
        {/* Top bar info */}
        <div
          className={`flex items-center justify-between w-full px-4 py-2 rounded-xl backdrop-blur-md transition-opacity ${
            isFullscreen ? 'opacity-20 hover:opacity-100' : 'opacity-100'
          }`}
          style={{
            backgroundColor: activeColor.textLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)',
            color: activeColor.textLight ? '#FFFFFF' : '#172033',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span>Color {colorIndex + 1} of {COLORS.length}:</span>
            <span>{activeColor.name} ({activeColor.hex})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={prevColor}
              className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
              title="Previous Color"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextColor}
              className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
              title="Next Color"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="px-2.5 py-1 rounded-lg bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
              {isFullscreen ? 'Exit Fullscreen' : 'Launch Fullscreen'}
            </button>
          </div>
        </div>

        {/* Center prompt if in windowed mode */}
        {!isFullscreen && (
          <div
            className="px-4 py-2 rounded-xl backdrop-blur-md text-xs font-semibold pointer-events-none text-center"
            style={{
              backgroundColor: activeColor.textLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)',
              color: activeColor.textLight ? '#FFFFFF' : '#172033',
            }}
          >
            Click anywhere or press Arrow Keys to cycle colors • Fullscreen recommended
          </div>
        )}

        {/* Bottom confirmation choices */}
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onResultUpdate && onResultUpdate('passed', 'No dead or stuck pixels observed')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            No Dead Pixels Observed
          </button>
          <button
            onClick={() => onResultUpdate && onResultUpdate('warning', 'Stuck / Dead pixel noticed during visual inspection')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer"
          >
            Found Dead / Stuck Pixel
          </button>
        </div>
      </div>
    </div>
  );
}
