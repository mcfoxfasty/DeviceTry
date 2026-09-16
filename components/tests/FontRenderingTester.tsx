'use client';

import React, { useState } from 'react';
import { Type, Sun, Moon } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

const SIZES = [9, 12, 14, 16, 20, 28, 36];

const SAMPLES: { label: string; text: string; className?: string }[] = [
  {
    label: 'Latin — English',
    text: 'The quick brown fox jumps over the lazy dog 0123456789',
  },
  {
    label: 'Latin — French accents',
    text: 'Voix ambiguë d’un cœur qui, au zéphyr, préfère les jattes de kiwis.',
  },
  {
    label: 'Arabic — RTL shaping & ligatures',
    text: 'النص العربي جميل وواضح — فحص نقاء الخطوط والتنعيم الفرعي للبيكسل',
    className: 'rtl text-right',
    // eslint-disable-next-line react-hooks/immutability
  },
];

export function FontRenderingTester({ onResultUpdate }: TesterProps) {
  const [dark, setDark] = useState<boolean>(false);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Type className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Font &amp; Text Rendering Test</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Subpixel antialiasing, kerning, Arabic shaping and size ramp</p>
          </div>
        </div>
        <button
          onClick={() => setDark((d) => !d)}
          className="px-3 py-2 rounded-lg bg-white dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] text-xs font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-1.5 cursor-pointer"
        >
          {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {dark ? 'Light Background' : 'Dark Background'}
        </button>
      </div>

      <div
        className="mt-5 rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 space-y-6 transition-colors"
        style={{ backgroundColor: dark ? '#0B111A' : '#FFFFFF', color: dark ? '#E9EEF4' : '#142033' }}
      >
        {SAMPLES.map((sample) => (
          <div key={sample.label}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-2">{sample.label}</p>
            <div className="space-y-2">
              {SIZES.map((size) => (
                <p
                  key={size}
                  className={`${sample.className ?? ''} leading-snug`}
                  style={{
                    fontSize: `${size}px`,
                    fontFamily: sample.label.startsWith('Arabic')
                      ? 'system-ui, "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif'
                      : undefined,
                  }}
                >
                  <span className="font-mono-num opacity-50 mr-2" style={{ fontSize: '10px' }}>{size}px</span>
                  {sample.text}
                </p>
              ))}
            </div>
          </div>
        ))}

        {/* Kerning pairs & monospace alignment strip */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-2">Kerning pairs &amp; tabular figures</p>
          <div className="flex flex-wrap gap-6">
            {['AV', 'AW', 'LT', 'ry', 'To', 'We', 'il1', '0O', 'Il'].map((pair) => (
              <span key={pair} className="text-2xl font-semibold">{pair}</span>
            ))}
          </div>
          <p className="font-mono-num text-lg mt-2">1234567890 • 11111 • 88888</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
          Look for fuzzy edges, uneven stroke weight, broken Arabic letter joins, or blurred small text.
        </p>
        <button
          onClick={() => onResultUpdate?.('passed', 'Typography inspected across sizes and backgrounds')}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold cursor-pointer shrink-0"
        >
          Confirm Text Looks Sharp
        </button>
      </div>
    </div>
  );
}
