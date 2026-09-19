'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function ContrastCheckerTester({ onResultUpdate }: ToolComponentProps) {
  const [fgColor, setFgColor] = useState<string>('#0F766E');
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');

  const getLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    const [R, G, B] = [r, g, b].map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  const computeRatio = useCallback((fg: string, bg: string): number => {
    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
  }, []);

  const contrastRatio = useMemo(() => computeRatio(fgColor, bgColor), [fgColor, bgColor, computeRatio]);

  useEffect(() => {
    const passed = contrastRatio >= 4.5 ? 'passed' : contrastRatio >= 3.0 ? 'warning' : 'failed';
    onResultUpdate?.(passed, `Contrast ratio: ${contrastRatio}:1`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrastRatio]);

  const passesAANormal = contrastRatio >= 4.5;
  const passesAALarge = contrastRatio >= 3.0;
  const passesAAANormal = contrastRatio >= 7.0;
  const passesAAALarge = contrastRatio >= 4.5;

  return (
    <div className="space-y-6">
      {/* Inputs & Controls */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Foreground picker */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4]">
            Foreground / Text Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={fgColor}
              onChange={(e) => setFgColor(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer border border-[#DFE5EB] dark:border-[#223043]"
            />
            <input
              type="text"
              value={fgColor}
              onChange={(e) => setFgColor(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] font-mono text-xs text-[#172033] dark:text-[#E9EEF4]"
            />
          </div>
        </div>

        {/* Background picker */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#172033] dark:text-[#E9EEF4]">
            Background Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer border border-[#DFE5EB] dark:border-[#223043]"
            />
            <input
              type="text"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] font-mono text-xs text-[#172033] dark:text-[#E9EEF4]"
            />
          </div>
        </div>
      </div>

      {/* Main Ratio & Compliance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ratio Stat Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-bold text-[#59677D] dark:text-[#9AA6B8] uppercase tracking-wider">
            Contrast Ratio
          </span>
          <div className="text-5xl font-mono font-black text-[#172033] dark:text-[#E9EEF4] my-2">
            {contrastRatio}:1
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              passesAANormal
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
            }`}
          >
            {passesAANormal ? 'WCAG AA Compliant' : 'Fails WCAG AA Normal Text'}
          </span>
        </div>

        {/* WCAG Compliance Badges */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#172033] dark:text-[#E9EEF4]">
              <span>WCAG AA Normal Text</span>
              <span className={passesAANormal ? 'text-emerald-600' : 'text-red-500'}>
                {passesAANormal ? 'PASS (≥ 4.5:1)' : 'FAIL'}
              </span>
            </div>
            <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8]">Body copy, inputs, tooltips</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#172033] dark:text-[#E9EEF4]">
              <span>WCAG AA Large Text</span>
              <span className={passesAALarge ? 'text-emerald-600' : 'text-red-500'}>
                {passesAALarge ? 'PASS (≥ 3.0:1)' : 'FAIL'}
              </span>
            </div>
            <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8]">18pt+ regular or 14pt+ bold</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#172033] dark:text-[#E9EEF4]">
              <span>WCAG AAA Normal Text</span>
              <span className={passesAAANormal ? 'text-emerald-600' : 'text-red-500'}>
                {passesAAANormal ? 'PASS (≥ 7.0:1)' : 'FAIL'}
              </span>
            </div>
            <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8]">Enhanced accessibility grade</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#172033] dark:text-[#E9EEF4]">
              <span>WCAG AAA Large Text</span>
              <span className={passesAAALarge ? 'text-emerald-600' : 'text-red-500'}>
                {passesAAALarge ? 'PASS (≥ 4.5:1)' : 'FAIL'}
              </span>
            </div>
            <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8]">High contrast headings</p>
          </div>
        </div>
      </div>

      {/* Live Sample Preview Box */}
      <div
        className="p-8 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] space-y-3 transition-colors shadow-sm"
        style={{ backgroundColor: bgColor, color: fgColor }}
      >
        <h4 className="text-2xl font-black">Headline Sample Preview (18pt Bold)</h4>
        <p className="text-base leading-relaxed">
          This is an example body text paragraph rendered with your selected color combination. Accessible digital experiences ensure high readability for all users across diverse display panels and lighting environments.
        </p>
      </div>
    </div>
  );
}
