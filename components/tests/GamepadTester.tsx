'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, AlertTriangle, CheckCircle, Crosshair, Zap } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';

interface GamepadTesterProps {
  t: Translations;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
}

const BUTTON_LABELS = [
  'A / Cross (0)',
  'B / Circle (1)',
  'X / Square (2)',
  'Y / Triangle (3)',
  'LB / L1 (4)',
  'RB / R1 (5)',
  'LT / L2 (6)',
  'RT / R2 (7)',
  'Back / Share (8)',
  'Start / Options (9)',
  'L3 / Left Stick (10)',
  'R3 / Right Stick (11)',
  'D-Pad Up (12)',
  'D-Pad Down (13)',
  'D-Pad Left (14)',
  'D-Pad Right (15)',
  'Guide / Home (16)',
];

export function GamepadTester({ t, onRecordResult }: GamepadTesterProps) {
  const { result, emitRich, clear } = useTestResult({ onRecordResult });
  const [gamepads, setGamepads] = useState<{ id: string; index: number; buttons: number[]; axes: number[] }[]>([]);
  const [selectedPadIndex, setSelectedPadIndex] = useState<number>(0);
  const [isCalibratingNeutral, setIsCalibratingNeutral] = useState<boolean>(false);
  const [neutralCalibrationPassed, setNeutralCalibrationPassed] = useState<boolean | null>(null);
  const [vibrationSupported, setVibrationSupported] = useState<boolean>(false);

  const calibrationSamplesRef = useRef<{ leftMax: number; rightMax: number }[]>([]);
  const isCalibratingRef = useRef<boolean>(false);

  useEffect(() => {
    let animId: number;

    const pollGamepads = () => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const rawPads = navigator.getGamepads();
        const active: { id: string; index: number; buttons: number[]; axes: number[] }[] = [];

        for (let i = 0; i < rawPads.length; i++) {
          const pad = rawPads[i];
          if (pad) {
            active.push({
              id: pad.id,
              index: pad.index,
              buttons: pad.buttons.map((b) => (typeof b === 'number' ? b : b.value)),
              axes: Array.from(pad.axes),
            });

            // Check vibration actuator support
            if (
              (pad as unknown as { vibrationActuator?: { playEffect: unknown } }).vibrationActuator &&
              !vibrationSupported
            ) {
              setVibrationSupported(true);
            }

            // If currently taking idle calibration samples
            if (isCalibratingRef.current && pad.index === selectedPadIndex) {
              const leftDist = Math.hypot(pad.axes[0] || 0, pad.axes[1] || 0);
              const rightDist = Math.hypot(pad.axes[2] || 0, pad.axes[3] || 0);
              calibrationSamplesRef.current.push({ leftMax: leftDist, rightMax: rightDist });
            }
          }
        }

        setGamepads(active);

        if (active.length > 0 && !isCalibratingRef.current) {
          const current = active.find((p) => p.index === selectedPadIndex) || active[0];
          emitRich({
            status: 'passed',
            details: `Controller active: ${current.id}. Buttons & axes polling correctly.`,
            metrics: { padId: current.id, buttonCount: current.buttons.length },
          });
        }
      }

      animId = requestAnimationFrame(pollGamepads);
    };

    animId = requestAnimationFrame(pollGamepads);

    return () => cancelAnimationFrame(animId);
  }, [selectedPadIndex, vibrationSupported, onRecordResult]);

  // Neutral Drift Calibration Test (Observed 2.5 seconds while idle)
  const startNeutralCalibration = () => {
    setIsCalibratingNeutral(true);
    setNeutralCalibrationPassed(null);
    calibrationSamplesRef.current = [];
    isCalibratingRef.current = true;

    setTimeout(() => {
      isCalibratingRef.current = false;
      setIsCalibratingNeutral(false);

      const samples = calibrationSamplesRef.current;
      if (samples.length > 10) {
        const maxLeft = Math.max(...samples.map((s) => s.leftMax));
        const maxRight = Math.max(...samples.map((s) => s.rightMax));
        // Standard dead-zone threshold: 12%
        const hasDrift = maxLeft > 0.12 || maxRight > 0.12;
        setNeutralCalibrationPassed(!hasDrift);

        emitRich({
          status: hasDrift ? 'warning' : 'passed',
          details: hasDrift
            ? `Idle stick resting offset exceeded 12% deadzone (Left: ${(maxLeft * 100).toFixed(1)}%, Right: ${(maxRight * 100).toFixed(1)}%).`
            : `Neutral calibration verified clean centering within 12% deadzone.`,
          metrics: { maxLeftIdleOffset: maxLeft, maxRightIdleOffset: maxRight },
        });
      }
    }, 2500);
  };

  const testVibration = () => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const rawPads = navigator.getGamepads();
    const current = rawPads[selectedPadIndex] || rawPads[0];
    if (current && (current as unknown as { vibrationActuator?: { playEffect: (type: string, opts: unknown) => Promise<unknown> } }).vibrationActuator) {
      try {
        (current as unknown as { vibrationActuator: { playEffect: (type: string, opts: unknown) => Promise<unknown> } }).vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: 400,
          weakMagnitude: 0.8,
          strongMagnitude: 0.8,
        });
      } catch {
        // ignore
      }
    }
  };

  const activePad = gamepads.find((p) => p.index === selectedPadIndex) || gamepads[0];

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.gamepadTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.gamepadTest.shortDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          {gamepads.length > 1 && (
            <select
              value={selectedPadIndex}
              onChange={(e) => setSelectedPadIndex(Number(e.target.value))}
              className="text-xs bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded px-3 py-1.5 focus:outline-none"
            >
              {gamepads.map((p) => (
                <option key={p.index} value={p.index}>
                  Pad #{p.index}: {p.id.slice(0, 24)}...
                </option>
              ))}
            </select>
          )}

          {vibrationSupported && (
            <button
              onClick={testVibration}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#E6F4F2] text-[#142033] dark:text-[#E9EEF4] text-xs font-semibold rounded-lg border border-[#DFE5EB] dark:border-[#223043] transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Test Vibration
            </button>
          )}
        </div>
      </div>

      {activePad ? (
        <div className="mt-6 space-y-6">
          {/* Controller Header */}
          <div className="p-3 bg-[#F6F7F9] dark:bg-[#192332] rounded-lg border border-[#DFE5EB] dark:border-[#223043] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4]">
                {activePad.id}
              </span>
            </div>
            <span className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
              {activePad.buttons.length} buttons / {activePad.axes.length} axes
            </span>
          </div>

          {/* Neutral Drift Idle Calibration */}
          <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#142033] dark:text-[#E9EEF4]">
                  Neutral Stick Drift Check
                </h3>
                <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">
                  Release both sticks and observe resting deadzone for 2.5 seconds.
                </p>
              </div>

              <button
                onClick={startNeutralCalibration}
                disabled={isCalibratingNeutral}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Crosshair className="w-3.5 h-3.5" />
                {isCalibratingNeutral ? 'Measuring Idle Rest...' : 'Run Neutral Check'}
              </button>
            </div>

            {neutralCalibrationPassed !== null && (
              <div
                className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  neutralCalibrationPassed
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {neutralCalibrationPassed ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>
                  {neutralCalibrationPassed
                    ? 'Sticks rested stably within the acceptable 12% neutral deadzone.'
                    : 'Resting stick position drifted outside the 12% neutral deadzone.'}
                </span>
              </div>
            )}
          </div>

          {/* Analog Joysticks 2D Radars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left Stick (Axes 0, 1) */}
            <div className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex flex-col items-center">
              <p className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4] mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#0F766E]" />
                {t.gamepadTest.leftStick} (Axes 0, 1)
              </p>

              <div className="w-32 h-32 rounded-full border-2 border-dashed border-[#CBD5E1] dark:border-[#31435D] bg-white dark:bg-[#131B27] relative flex items-center justify-center">
                {/* Crosshairs */}
                <div className="absolute w-full h-[1px] bg-slate-200 dark:bg-slate-800" />
                <div className="absolute h-full w-[1px] bg-slate-200 dark:bg-slate-800" />

                {/* Stick Position Dot */}
                <div
                  className="absolute w-5 h-5 rounded-full bg-[#0F766E] shadow transition-all duration-75"
                  style={{
                    transform: `translate(${((activePad.axes[0] || 0) * 50).toFixed(1)}px, ${(
                      (activePad.axes[1] || 0) * 50
                    ).toFixed(1)}px)`,
                  }}
                />
              </div>

              <div className="mt-3 text-[11px] font-mono-num text-[#5F6B7A] dark:text-[#9AA6B8]">
                X: {(activePad.axes[0] || 0).toFixed(3)} | Y: {(activePad.axes[1] || 0).toFixed(3)}
              </div>
            </div>

            {/* Right Stick (Axes 2, 3) */}
            <div className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex flex-col items-center">
              <p className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4] mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#0F766E]" />
                {t.gamepadTest.rightStick} (Axes 2, 3)
              </p>

              <div className="w-32 h-32 rounded-full border-2 border-dashed border-[#CBD5E1] dark:border-[#31435D] bg-white dark:bg-[#131B27] relative flex items-center justify-center">
                {/* Crosshairs */}
                <div className="absolute w-full h-[1px] bg-slate-200 dark:bg-slate-800" />
                <div className="absolute h-full w-[1px] bg-slate-200 dark:bg-slate-800" />

                {/* Stick Position Dot */}
                <div
                  className="absolute w-5 h-5 rounded-full bg-[#0F766E] shadow transition-all duration-75"
                  style={{
                    transform: `translate(${((activePad.axes[2] || 0) * 50).toFixed(1)}px, ${(
                      (activePad.axes[3] || 0) * 50
                    ).toFixed(1)}px)`,
                  }}
                />
              </div>

              <div className="mt-3 text-[11px] font-mono-num text-[#5F6B7A] dark:text-[#9AA6B8]">
                X: {(activePad.axes[2] || 0).toFixed(3)} | Y: {(activePad.axes[3] || 0).toFixed(3)}
              </div>
            </div>
          </div>

          {/* Button Matrix */}
          <div>
            <p className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-2">
              {t.gamepadTest.buttonsTitle}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activePad.buttons.map((val, idx) => {
                const isPressed = val > 0.1;
                const label = BUTTON_LABELS[idx] || `Button ${idx}`;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                      isPressed
                        ? 'bg-[#0F766E] text-white border-[#0D665F] font-bold shadow-sm'
                        : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    <span className="font-mono-num text-[11px] ml-1">
                      {val > 0.05 ? val.toFixed(2) : '0'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <Gamepad2 className="w-10 h-10 text-[#5F6B7A] dark:text-[#9AA6B8] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-[#142033] dark:text-[#E9EEF4]">
            {t.gamepadTest.noGamepadDetected}
          </p>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 max-w-md mx-auto">
            {t.gamepadTest.connectPrompt}
          </p>
        </div>
      )}

      {/* Test result — in-card, directly under the test area */}
      <TestResultBanner result={result} onClear={clear} />

      {/* Hardware Disclaimer */}
      <div className="mt-6 pt-5 border-t border-[#DFE5EB] dark:border-[#223043] text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
          {t.gamepadTest.axesTitle}
        </h3>
        <p className="leading-relaxed">{t.gamepadTest.driftNotice}</p>
        <p className="mt-2 text-[11px] text-[#8996A6] italic">
          {t.gamepadTest.calibrationDisclaimer}
        </p>
      </div>
    </div>
  );
}
