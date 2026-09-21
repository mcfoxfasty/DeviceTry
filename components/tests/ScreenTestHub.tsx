'use client';

import React, { useState } from 'react';
import { Grid3x3, Palette, Info } from 'lucide-react';
import { DeadPixelTester } from './DeadPixelTester';
import { DisplayPatternsTester } from './DisplayPatternsTester';
import { ScreenInfoTester } from './ScreenInfoTester';
import { Translations } from '@/lib/i18n/types';

interface ScreenTestHubProps {
  t: Translations;
  /** Host-page/guided telemetry hook, forwarded to the active tab's tester. */
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  /** Initial tab (migration deep links use ?tab=patterns etc.). */
  initialTab?: string;
}

type ScreenTab = 'dead-pixel' | 'patterns' | 'screen-info';

/**
 * Merged screen tool (Phase 9, item B): Dead Pixel, Display Patterns, and
 * Screen Info combine into /test/screen-test. Each tab keeps its existing
 * instructions, limitations, and behavior; tabs are display-only so no media
 * lifecycle applies, and only the active tab renders.
 */
export function ScreenTestHub({ t, onResultUpdate, initialTab }: ScreenTestHubProps) {
  const isInitialTabValid = initialTab === 'dead-pixel' || initialTab === 'patterns' || initialTab === 'screen-info';
  const [tab, setTab] = useState<ScreenTab>(isInitialTabValid ? initialTab : 'dead-pixel');

  const TABS: Array<{ key: ScreenTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'dead-pixel', label: 'Dead Pixel', icon: Grid3x3 },
    { key: 'patterns', label: 'Patterns', icon: Palette },
    { key: 'screen-info', label: 'Screen Info', icon: Info },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Screen test modes" className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tab === key
                ? 'bg-[#0F766E] text-white shadow-sm dark:bg-[#14B8A6] dark:text-[#0B111A]'
                : 'bg-white dark:bg-[#192332] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'dead-pixel' && <DeadPixelTester t={t} onResultUpdate={onResultUpdate} />}
        {tab === 'patterns' && <DisplayPatternsTester t={t} onResultUpdate={onResultUpdate} />}
        {tab === 'screen-info' && <ScreenInfoTester t={t} onResultUpdate={onResultUpdate} />}
      </div>
    </div>
  );
}
