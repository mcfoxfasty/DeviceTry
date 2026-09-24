'use client';

import React from 'react';
import { Translations } from '@/lib/i18n/types';
import { ToolDefinition } from '@/lib/tools/types';
import { TesterWithBanner } from '@/components/TestResultBanner';

import { MicrophoneTestHub } from './tests/MicrophoneTestHub';
import { WebcamTestHub } from './tests/WebcamTestHub';
import { SpeakersTester } from './tests/SpeakersTester';
import { VoiceRecorderTester } from './tests/VoiceRecorderTester';
import { ToneGeneratorTester } from './tests/ToneGeneratorTester';
import { KeyboardTester } from './tests/KeyboardTester';
import { MouseTester } from './tests/MouseTester';
import { TouchscreenTestHub } from './tests/TouchscreenTestHub';
import { GamepadTester } from './tests/GamepadTester';
import { ClickSpeedTester } from './tests/ClickSpeedTester';
import { ReactionTimeTester } from './tests/ReactionTimeTester';
import { ScreenTestHub } from './tests/ScreenTestHub';
import { RefreshRateTester } from './tests/RefreshRateTester';
import { WhatsMyIpTester } from './tests/WhatsMyIpTester';

import { BrowserSystemInfoTester } from './tests/BrowserSystemInfoTester';
import { BrowserCompatibilityTester } from './tests/BrowserCompatibilityTester';
import { PermissionDiagnosticsTester } from './tests/PermissionDiagnosticsTester';
import { PrivacyStorageInspectorTester } from './tests/PrivacyStorageInspectorTester';
import { CodecSupportTester } from './tests/CodecSupportTester';
import { WebRTCTester } from './tests/WebRTCTester';

import dynamic from 'next/dynamic';

/**
 * Heavy provider-backed tester is code-split: its chunk (including the
 * @cloudflare/speedtest engine) loads only when the tool page requests it,
 * never on initial site load (Phase 9, item M).
 */
const LazyInternetSpeedTester = dynamic(() => import('./tests/InternetSpeedTester').then((m) => m.InternetSpeedTester), {
  ssr: false,
  loading: () => (
    <div className="p-8 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#111D30] text-center">
      <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Loading speed test…</p>
    </div>
  ),
});

export type ToolResultStatus = 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured' | 'unsupported';

export interface ToolResultPayload {
  status: ToolResultStatus;
  details: string;
  metrics?: Record<string, unknown>;
}

interface ToolRendererProps {
  tool: ToolDefinition;
  t: Translations;
  /** Generic result hook for testers that report (status, details). */
  onResultUpdate?: (status: ToolResultStatus, details?: string) => void;  /** Rich result hook for flagship testers that report a full payload. */
  onRecordResult?: (result: ToolResultPayload) => void;
  /** Host hook notified when a tester clears/resets its result. */
  onResultClear?: () => void;
  /** Initial tab for merged-tab tools (migration deep links, ?tab=...). */
  initialTab?: string;
  /** Enable privacy-safe share + browser-local history for this tool's banner. */
  withShare?: boolean;
}

/**
 * Registry-driven render map. Exported so tests can assert that every
 * registry componentName resolves to a real tester component. Testers own
 * their prop types, so the map is typed loosely and the rich/flagship split
 * below applies the correct callbacks per tester.
 */
export const TESTER_COMPONENTS: Record<string, React.ComponentType<any>> = {
  // Primary catalog (15)
  MicrophoneTester: MicrophoneTestHub,
  WebcamTester: WebcamTestHub,
  SpeakersTester,
  VoiceRecorderTester,
  ToneGeneratorTester,
  KeyboardTester,
  MouseTester,
  TouchscreenTester: TouchscreenTestHub,
  GamepadTester,
  ClickSpeedTester,
  ReactionTimeTester,
  ScreenTestHub,
  RefreshRateTester,
  InternetSpeedTester: LazyInternetSpeedTester,
  WhatsMyIpTester,
  // Supporting diagnostics (6)
  BrowserSystemInfoTester,
  BrowserCompatibilityTester,
  PermissionDiagnosticsTester,
  PrivacyStorageInspectorTester,
  CodecSupportTester,
  WebRTCTester,
};

/**
 * Testers that render their own in-card banner and receive the host result
 * sink plus the registry identity directly. Rich flagships additionally take
 * the rich payload callback (onRecordResult).
 */
const DIRECT_MOUNT_TESTERS: ReadonlySet<string> = new Set([
  'GamepadTester',
  'KeyboardTester',
  'MouseTester',
  'SpeakersTester',
  'WebcamTester',
  'MicrophoneTester',
  // Owns its internal banner; wrapping it in TesterWithBanner would render
  // two banners and its own verdict stream would bypass the host sink.
  'ReactionTimeTester',
  // Owns its presentation but not a banner: the rich payload (with numeric
  // measurements) must reach the shared banner for Phase 3 rerun comparison
  // and CSV export. Lazily code-split, so TesterWithBanner must not wrap it.
  'InternetSpeedTester',
]);

/**
 * Renders the correct tester component for a registry tool definition.
 * Unknown componentName throws (loud) instead of rendering nothing (silent).
 */export function ToolRenderer({ tool, t, onResultUpdate, onRecordResult, onResultClear, initialTab, withShare = true }: ToolRendererProps) {
  const Tester = TESTER_COMPONENTS[tool.componentName];

  if (!Tester) {
    throw new Error(`ToolRenderer: no tester component registered for "${tool.componentName}" (tool id: ${tool.id})`);
  }

  const bannerExtras = withShare
    ? { toolId: tool.id, toolTitle: tool.title, toolSlug: tool.slug }
    : {};

  if (DIRECT_MOUNT_TESTERS.has(tool.componentName)) {
    return (
      <Tester
        t={t}
        onRecordResult={onRecordResult}
        onResultUpdate={onResultUpdate}
        onResultClear={onResultClear}
        initialTab={initialTab}
        {...bannerExtras}
      />
    );
  }
  return (
    <TesterWithBanner
      tester={Tester}
      testerProps={{ t, onResultUpdate, initialTab }}
      onResultUpdate={onResultUpdate}
      onResultClear={onResultClear}
      {...bannerExtras}
    />
  );
}

export default ToolRenderer;
