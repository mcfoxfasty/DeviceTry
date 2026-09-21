'use client';

import React, { useState } from 'react';
import { Camera, FlipHorizontal } from 'lucide-react';
import { WebcamTester } from './WebcamTester';
import { OnlineMirrorTester } from './OnlineMirrorTester';
import { Translations } from '@/lib/i18n/types';

type CamTab = 'test' | 'mirror';

interface WebcamTestHubProps {
  t: Translations;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
  onResultClear?: () => void;
  /** Initial tab (migration deep links use ?tab=mirror). */
  initialTab?: string;
}

/**
 * Merged webcam tool (Phase 9, item B): the full diagnostic tester and the
 * Online Mirror share one page through exclusive tabs. Only one camera
 * session exists at a time — switching tabs unmounts the previous tester,
 * which stops every track through the Phase 2 CameraSession lifecycle.
 */
export function WebcamTestHub({ t, onRecordResult, onResultClear, initialTab }: WebcamTestHubProps) {
  const isInitialTabValid = initialTab === 'test' || initialTab === 'mirror';
  const [tab, setTab] = useState<CamTab>(isInitialTabValid ? initialTab : 'test');

  const TABS: Array<{ key: CamTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'test', label: 'Camera Test', icon: Camera },
    { key: 'mirror', label: 'Mirror', icon: FlipHorizontal },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Webcam test modes" className="flex flex-wrap gap-1.5 mb-4">
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
        {tab === 'test' && <WebcamTester t={t} onRecordResult={onRecordResult} onResultClear={onResultClear} />}
        {/* OnlineMirror reports the (status, details) shape; adapt the hub's
            rich payload hook so both tabs reach the same guided sink. */}
        {tab === 'mirror' && (
          <OnlineMirrorTester t={t} onResultUpdate={(s, d) => onRecordResult?.({ status: s, details: d ?? '' })} />
        )}
      </div>
    </div>
  );
}
