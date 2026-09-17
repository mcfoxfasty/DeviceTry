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
 * Renders the correct tester component for a registry tool definition.
 * Covers all 38 registry componentName entries — no silent wrong-tool fallbacks.
 * Result telemetry is wired through so host pages can display outcomes.
 */
export function ToolRenderer({ tool, t, onResultUpdate, onRecordResult }: ToolRendererProps) {
  switch (tool.componentName) {
    case 'MicrophoneTester':
      return <MicrophoneTester t={t} onRecordResult={onRecordResult} />;
    case 'WebcamTester':
      return <WebcamTester t={t} onRecordResult={onRecordResult} />;
    case 'SpeakersTester':
      return <SpeakersTester t={t} onRecordResult={onRecordResult} />;
    case 'VoiceRecorderTester':
      return <TesterWithBanner tester={VoiceRecorderTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'OnlineMirrorTester':
      return <TesterWithBanner tester={OnlineMirrorTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'ToneGeneratorTester':
      return <TesterWithBanner tester={ToneGeneratorTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'ClickCounterTester':
      return <TesterWithBanner tester={ClickCounterTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'KeyboardTester':
      return <KeyboardTester t={t} onRecordResult={onRecordResult} />;
    case 'MouseTester':
      return <MouseTester t={t} onRecordResult={onRecordResult} />;
    case 'TouchscreenTester':
      return <TesterWithBanner tester={TouchscreenTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'MultitouchTester':
      return <TesterWithBanner tester={MultitouchTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'GamepadTester':
      return <GamepadTester t={t} onRecordResult={onRecordResult} />;
    case 'DeadPixelTester':
      return <TesterWithBanner tester={DeadPixelTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'DisplayPatternsTester':
      return <TesterWithBanner tester={DisplayPatternsTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'ScreenInfoTester':
      return <TesterWithBanner tester={ScreenInfoTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'DisplayFpsTester':
      return <TesterWithBanner tester={DisplayFpsTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'BatteryTester':
      return <BatteryTester t={t} onRecordResult={onRecordResult} />;
    case 'AccelerometerTester':
      return <TesterWithBanner tester={AccelerometerTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'GyroscopeTester':
      return <TesterWithBanner tester={GyroscopeTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'VibrationTester':
      return <TesterWithBanner tester={VibrationTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'PitchDetectorTester':
      return <TesterWithBanner tester={PitchDetectorTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'InstrumentTunerTester':
      return <TesterWithBanner tester={InstrumentTunerTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'MetronomeTester':
      return <TesterWithBanner tester={MetronomeTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'BrowserSystemInfoTester':
      return <TesterWithBanner tester={BrowserSystemInfoTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'BrowserCompatibilityTester':
      return <TesterWithBanner tester={BrowserCompatibilityTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'PermissionDiagnosticsTester':
      return <TesterWithBanner tester={PermissionDiagnosticsTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'ClipboardTester':
      return <TesterWithBanner tester={ClipboardTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'BrowserStorageTester':
      return <TesterWithBanner tester={BrowserStorageTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'PrivacyStorageInspectorTester':
      return <TesterWithBanner tester={PrivacyStorageInspectorTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'FontRenderingTester':
      return <TesterWithBanner tester={FontRenderingTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'CodecSupportTester':
      return <TesterWithBanner tester={CodecSupportTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'CanvasBenchmarkTester':
      return <TesterWithBanner tester={CanvasBenchmarkTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'WebGLTester':
      return <TesterWithBanner tester={WebGLTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'JavascriptBenchmarkTester':
      return <TesterWithBanner tester={JavascriptBenchmarkTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'WebAssemblyTester':
      return <TesterWithBanner tester={WebAssemblyTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'WebRTCTester':
      return <TesterWithBanner tester={WebRTCTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'OfflineCheckTester':
      return <TesterWithBanner tester={OfflineCheckTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    case 'ClockTimezoneTester':
      return <TesterWithBanner tester={ClockTimezoneTester} testerProps={{ t }} onResultUpdate={onResultUpdate} />;
    default:
      return null;
  }
}

export default ToolRenderer;
