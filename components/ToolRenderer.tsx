'use client';

import React from 'react';
import { Translations } from '@/lib/i18n/types';
import { ToolDefinition } from '@/lib/tools/types';

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

interface ToolRendererProps {
  tool: ToolDefinition;
  t: Translations;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

/**
 * Renders the correct tester component for a registry tool definition.
 * Covers all 38 registry componentName entries — no silent wrong-tool fallbacks.
 */
export function ToolRenderer({ tool, t }: ToolRendererProps) {
  switch (tool.componentName) {
    case 'MicrophoneTester':
      return <MicrophoneTester t={t} />;
    case 'WebcamTester':
      return <WebcamTester t={t} />;
    case 'SpeakersTester':
      return <SpeakersTester t={t} />;
    case 'VoiceRecorderTester':
      return <VoiceRecorderTester t={t} />;
    case 'OnlineMirrorTester':
      return <OnlineMirrorTester t={t} />;
    case 'ToneGeneratorTester':
      return <ToneGeneratorTester t={t} />;
    case 'ClickCounterTester':
      return <ClickCounterTester t={t} />;
    case 'KeyboardTester':
      return <KeyboardTester t={t} />;
    case 'MouseTester':
      return <MouseTester t={t} />;
    case 'TouchscreenTester':
      return <TouchscreenTester t={t} />;
    case 'MultitouchTester':
      return <MultitouchTester t={t} />;
    case 'GamepadTester':
      return <GamepadTester t={t} />;
    case 'DeadPixelTester':
      return <DeadPixelTester t={t} />;
    case 'DisplayPatternsTester':
      return <DisplayPatternsTester t={t} />;
    case 'ScreenInfoTester':
      return <ScreenInfoTester t={t} />;
    case 'DisplayFpsTester':
      return <DisplayFpsTester t={t} />;
    case 'BatteryTester':
      return <BatteryTester t={t} />;
    case 'AccelerometerTester':
      return <AccelerometerTester t={t} />;
    case 'GyroscopeTester':
      return <GyroscopeTester t={t} />;
    case 'VibrationTester':
      return <VibrationTester t={t} />;
    case 'PitchDetectorTester':
      return <PitchDetectorTester t={t} />;
    case 'InstrumentTunerTester':
      return <InstrumentTunerTester t={t} />;
    case 'MetronomeTester':
      return <MetronomeTester t={t} />;
    case 'BrowserSystemInfoTester':
      return <BrowserSystemInfoTester t={t} />;
    case 'BrowserCompatibilityTester':
      return <BrowserCompatibilityTester t={t} />;
    case 'PermissionDiagnosticsTester':
      return <PermissionDiagnosticsTester t={t} />;
    case 'ClipboardTester':
      return <ClipboardTester t={t} />;
    case 'BrowserStorageTester':
      return <BrowserStorageTester t={t} />;
    case 'PrivacyStorageInspectorTester':
      return <PrivacyStorageInspectorTester t={t} />;
    case 'FontRenderingTester':
      return <FontRenderingTester t={t} />;
    case 'CodecSupportTester':
      return <CodecSupportTester t={t} />;
    case 'CanvasBenchmarkTester':
      return <CanvasBenchmarkTester t={t} />;
    case 'WebGLTester':
      return <WebGLTester t={t} />;
    case 'JavascriptBenchmarkTester':
      return <JavascriptBenchmarkTester t={t} />;
    case 'WebAssemblyTester':
      return <WebAssemblyTester t={t} />;
    case 'WebRTCTester':
      return <WebRTCTester t={t} />;
    case 'OfflineCheckTester':
      return <OfflineCheckTester t={t} />;
    case 'ClockTimezoneTester':
      return <ClockTimezoneTester t={t} />;
    default:
      return null;
  }
}

export default ToolRenderer;
