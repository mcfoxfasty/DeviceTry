'use client';

import React, { useState } from 'react';
import { AudioWaveform, Activity, Mic } from 'lucide-react';
import { MicrophoneTester } from './MicrophoneTester';
import { PitchDetectorTester } from './PitchDetectorTester';
import { VoiceRecorderTester } from './VoiceRecorderTester';
import { Translations } from '@/lib/i18n/types';

interface MicrophoneTestHubProps {
  t: Translations;
  /** Rich payload hook used by the Level & Waveform tab. */
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
  onResultClear?: () => void;
  /** Telemetry hook for the Pitch Detector and Recorder tabs. */
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  /** Initial tab (migration deep links use ?tab=pitch etc.). */
  initialTab?: string;
}

type MicTab = 'level' | 'pitch' | 'recorder';

/**
 * Merged microphone tool (Phase 9, item B). Exactly one tab's tester is
 * mounted at a time; unmounting a tab tears down its media stream, audio
 * graph, timers, and animation callbacks via each tester's existing Phase 2/3
 * lifecycle cleanup. No microphone session ever coexists with another tab's.
 */
export function MicrophoneTestHub({ t, onRecordResult, onResultClear, onResultUpdate, initialTab }: MicrophoneTestHubProps) {
  const isInitialTabValid = initialTab === 'level' || initialTab === 'pitch' || initialTab === 'recorder';
  const [tab, setTab] = useState<MicTab>(isInitialTabValid ? initialTab : 'level');

  // Exclusive mounting handles cleanup: switching tabs unmounts the previous
  // tester (its own Phase 2/3 lifecycle stops stream, graph, timers, rAF), and
  // unmounting the hub unmounts whichever tester is active with it.
  const TABS: Array<{ key: MicTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'level', label: 'Level & Waveform', icon: Activity },
    { key: 'pitch', label: 'Pitch Detector', icon: AudioWaveform },
    { key: 'recorder', label: 'Recorder', icon: Mic },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Microphone test modes" className="flex flex-wrap gap-1.5 mb-4">
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

      {/* Exclusive mounting: switching tabs unmounts the previous tester,
          which stops its stream, audio graph, timers, and listeners. */}
      <div role="tabpanel">
        {tab === 'level' && <MicrophoneTester t={t} onRecordResult={onRecordResult} onResultClear={onResultClear} />}
        {tab === 'pitch' && <PitchDetectorTester t={t} onResultUpdate={onResultUpdate} />}
        {tab === 'recorder' && <VoiceRecorderTester t={t} onResultUpdate={onResultUpdate} />}
      </div>
    </div>
  );
}
