'use client';

import React, { useState } from 'react';
import { Hand, Fingerprint } from 'lucide-react';
import { TouchscreenTester } from './TouchscreenTester';
import { MultitouchTester } from './MultitouchTester';
import { Translations } from '@/lib/i18n/types';

interface TouchscreenTestHubProps {
  t: Translations;
  /** Host-page/guided telemetry hook, forwarded to the active tab's tester. */
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  /** Initial tab (migration deep links use ?tab=multi-touch). */
  initialTab?: string;
}

type TouchTab = 'touch' | 'multi-touch';

/**
 * Merged touchscreen tool (Phase 9, item B): coverage tiles and multi-touch
 * observation share one page through exclusive tabs. Touch/mouse/pen
 * distinctions and observed-coverage rules live inside each tester. Only the
 * active tab is mounted, so input listeners never coexist across tabs.
 */
export function TouchscreenTestHub({ t, onResultUpdate, initialTab }: TouchscreenTestHubProps) {
  const isInitialTabValid = initialTab === 'touch' || initialTab === 'multi-touch';
  const [tab, setTab] = useState<TouchTab>(isInitialTabValid ? initialTab : 'touch');

  const TABS: Array<{ key: TouchTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'touch', label: 'Coverage', icon: Hand },
    { key: 'multi-touch', label: 'Multi-Touch', icon: Fingerprint },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Touchscreen test modes" className="flex flex-wrap gap-1.5 mb-4">
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
        {/* TouchscreenTester reports only the four core statuses; the adapter
            narrows the hub's wider hook type without ever dropping a call. */}
        {tab === 'touch' && (
          <TouchscreenTester t={t} onResultUpdate={(s, d) => onResultUpdate?.(s, d)} />
        )}
        {tab === 'multi-touch' && <MultitouchTester t={t} onResultUpdate={onResultUpdate} />}
      </div>
    </div>
  );
}
