'use client';

import React from 'react';
import { Translations } from '@/lib/i18n/types';
import { ToolDefinition } from '@/lib/tools/types';
import { TesterWithBanner } from '@/components/TestResultBanner';

import { MicrophoneTester } from './tests/MicrophoneTester';
import { WebcamTester } from './tests/WebcamTester';
import { SpeakersTester } from './tests/SpeakersTester';
import { VoiceRecorderTester } from './tests/VoiceRecorderTester';
import { OnlineMirrorTester } from './tests/OnlineMirrorTester';
import { ToneGeneratorTester } from './tests/ToneGeneratorTester';
import { ClickCounterTester } from './tests/ClickCounterTester';
import { KeyboardTester } from './tests/KeyboardTester';
import { MouseTester } from './tests/MouseTester';
import { TouchscreenTester } from './tests/TouchscreenTester';
import { MultitouchTester } from './tests/MultitouchTester';
import { GamepadTester } from './tests/GamepadTester';
import { DeadPixelTester } from './tests/DeadPixelTester';
import { DisplayPatternsTester } from './tests/DisplayPatternsTester';
import { ScreenInfoTester } from './tests/ScreenInfoTester';
import { DisplayFpsTester } from './tests/DisplayFpsTester';
import { BatteryTester } from './tests/BatteryTester';
import { AccelerometerTester } from './tests/AccelerometerTester';
import { GyroscopeTester } from './tests/GyroscopeTester';
import { VibrationTester } from './tests/VibrationTester';
import { PitchDetectorTester } from './tests/PitchDetectorTester';
import { InstrumentTunerTester } from './tests/InstrumentTunerTester';
import { MetronomeTester } from './tests/MetronomeTester';
import { BrowserSystemInfoTester } from './tests/BrowserSystemInfoTester';
import { BrowserCompatibilityTester } from './tests/BrowserCompatibilityTester';
import { PermissionDiagnosticsTester } from './tests/PermissionDiagnosticsTester';
import { ClipboardTester } from './tests/ClipboardTester';
import { BrowserStorageTester } from './tests/BrowserStorageTester';
import { PrivacyStorageInspectorTester } from './tests/PrivacyStorageInspectorTester';
import { FontRenderingTester } from './tests/FontRenderingTester';
import { CodecSupportTester } from './tests/CodecSupportTester';
import { CanvasBenchmarkTester } from './tests/CanvasBenchmarkTester';
import { WebGLTester } from './tests/WebGLTester';
import { JavascriptBenchmarkTester } from './tests/JavascriptBenchmarkTester';
import { WebAssemblyTester } from './tests/WebAssemblyTester';
import { WebRTCTester } from './tests/WebRTCTester';
import { OfflineCheckTester } from './tests/OfflineCheckTester';
import { ClockTimezoneTester } from './tests/ClockTimezoneTester';

export type ToolResultStatus = 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported';

export interface ToolResultPayload {
  status: ToolResultStatus;
  details: string;
  metrics?: Record<string, unknown>;
}

interface ToolRendererProps {
  tool: ToolDefinition;
  t: Translations;
  /** Generic result hook for the 30 testers that report (status, details). */
  onResultUpdate?: (status: ToolResultStatus, details?: string) => void;
  /** Rich result hook for the 8 flagship testers that report a full payload. */
  onRecordResult?: (result: ToolResultPayload) => void;
}

/**
 * Registry-driven render map. Exported so tests can assert that every
 * registry componentName resolves to a real tester component. Testers own
 * their prop types, so the map is typed loosely and the rich/flagship split
 * below applies the correct callbacks per tester.
 */
export const TESTER_COMPONENTS: Record<string, React.ComponentType<any>> = {
  MicrophoneTester,
  WebcamTester,
  SpeakersTester,
  VoiceRecorderTester,
  OnlineMirrorTester,
  ToneGeneratorTester,
  ClickCounterTester,
  KeyboardTester,
  MouseTester,
  TouchscreenTester,
  MultitouchTester,
  GamepadTester,
  DeadPixelTester,
  DisplayPatternsTester,
  ScreenInfoTester,
  DisplayFpsTester,
  BatteryTester,
  AccelerometerTester,
  GyroscopeTester,
  VibrationTester,
  PitchDetectorTester,
  InstrumentTunerTester,
  MetronomeTester,
  BrowserSystemInfoTester,
  BrowserCompatibilityTester,
  PermissionDiagnosticsTester,
  ClipboardTester,
  BrowserStorageTester,
  PrivacyStorageInspectorTester,
  FontRenderingTester,
  CodecSupportTester,
  CanvasBenchmarkTester,
  WebGLTester,
  JavascriptBenchmarkTester,
  WebAssemblyTester,
  WebRTCTester,
  OfflineCheckTester,
  ClockTimezoneTester,
};

/** Flagship testers receive the rich payload callback directly. */
const RICH_FLAGSHIP: ReadonlySet<string> = new Set([
  'MicrophoneTester',
  'WebcamTester',
  'SpeakersTester',
  'KeyboardTester',
  'MouseTester',
  'GamepadTester',
  'BatteryTester',
]);

/**
 * Renders the correct tester component for a registry tool definition.
 * Unknown componentName throws (loud) instead of rendering nothing (silent).
 * Result telemetry is wired through so host pages can display outcomes.
 */
export function ToolRenderer({ tool, t, onResultUpdate, onRecordResult }: ToolRendererProps) {
  const Tester = TESTER_COMPONENTS[tool.componentName];

  if (!Tester) {
    throw new Error(`ToolRenderer: no tester component registered for "${tool.componentName}" (tool id: ${tool.id})`);
  }

  if (RICH_FLAGSHIP.has(tool.componentName)) {
    return <Tester t={t} onRecordResult={onRecordResult} />;
  }
  return (
    <TesterWithBanner tester={Tester} testerProps={{ t }} onResultUpdate={onResultUpdate} />
  );
}

export default ToolRenderer;
