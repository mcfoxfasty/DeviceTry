'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gamepad2, AlertTriangle, CheckCircle, Crosshair, Zap } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import { CalibrationTracker, DRIFT_THRESHOLD, DriftVerdict } from '@/lib/testing/gamepadDrift';

interface GamepadTesterProps {
  t: Translations;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
  onResultClear?: () => void;
  /** Guided-inspection label so the user knows exactly which test to start. */
  startButtonLabel?: string;
  /** Registry identity for the in-card banner's safe share + history. */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
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

export function GamepadTester({ t, onRecordResult, onResultClear, startButtonLabel, toolId, toolTitle, toolSlug }: GamepadTesterProps) {
  const { result, emitRunRich, clear, startRun, invalidate, currentRun } = useTestResult({
    onRecordResult,
    onResultClear,
  });
  const [gamepads, setGamepads] = useState<{ id: string; index: number; buttons: number[]; axes: number[] }[]>([]);
  const [selectedPadIndex, setSelectedPadIndex] = useState<number>(0);
  const [isCalibratingNeutral, setIsCalibratingNeutral] = useState<boolean>(false);
  // UI mirror of the tracker's retained verdict, bound to the pad id that
  // produced it. Reconciled ONLY from event/callback contexts (rAF poll frame,
  // calibration timeout) — never from an effect body.
  const [verdictForPad, setVerdictForPad] = useState<{ padId: string; verdict: DriftVerdict } | null>(null);
  const [vibrationSupported, setVibrationSupported] = useState<boolean>(false);
  // Mirror for the rAF loop, which must not depend on state (would restart
  // the loop every time support flips).
  const vibrationSupportedRef = useRef<boolean>(false);

  // Calibration state machine (extracted for regression testing). The tracker
  // owns verdict retention; the component keeps UI-only mirrors of it.
  const trackerRef = useRef<CalibrationTracker>(new CalibrationTracker());
  const isCalibratingRef = useRef<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The selected pad's identity. Verdicts are locked per pad id, so a
  // different or reconnected controller can never inherit another pad's result.
  const selectedPadIdRef = useRef<string>('');

  // Unmount: cancel the calibration timeout and invalidate in-flight
  // emissions without deleting a completed guided result.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isCalibratingRef.current = false;
      invalidate();
    };
  }, [invalidate]);

  useEffect(() => {
    let animId: number;
    let cancelled = false;

    const pollGamepads = () => {
      if (cancelled) return;
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
              (pad as unknown as { vibrationActuator?: unknown }).vibrationActuator &&
              !vibrationSupportedRef.current
            ) {
              vibrationSupportedRef.current = true;
              setVibrationSupported(true);
            }

            // Feed the live calibration sampler (only for the selected pad).
            if (pad.index === selectedPadIndex && trackerRef.current.isCollectingFor(pad.id)) {
              const leftDist = Math.hypot(pad.axes[0] || 0, pad.axes[1] || 0);
              const rightDist = Math.hypot(pad.axes[2] || 0, pad.axes[3] || 0);
              trackerRef.current.addSample({ leftMax: leftDist, rightMax: rightDist });
            }
          }
        }

        setGamepads(active);

        const current = active.find((p) => p.index === selectedPadIndex) || active[0];

        // Selected pad identity tracking: selection change, disconnection, or
        // a reconnected pad (different id under the same index) invalidates
        // any verdict bound to the previous pad, so no result is retained
        // across controllers.
        const currentId = current?.id ?? '';
        if (currentId !== selectedPadIdRef.current) {
          trackerRef.current.invalidatePad(selectedPadIdRef.current);
          selectedPadIdRef.current = currentId;
          // Mirror the tracker: null unless the NEW pad retains its own verdict.
          setVerdictForPad(trackerRef.current.snapshot());
        }

        // Calibration completion is driven by the timeout (below); polling
        // frames only sample while the window is open.

        if (active.length === 0 && isCalibratingRef.current) {
          // Controller unplugged mid-calibration: the window can no longer
          // produce a verdict for this pad. Abort the window; the timeout
          // fires into a non-collecting tracker and reports nothing.
          isCalibratingRef.current = false;
          trackerRef.current.invalidatePad(selectedPadIdRef.current);
          setIsCalibratingNeutral(false);
          setVerdictForPad(null);
        }

        // CONNECTION verdict: emitted only while no calibration verdict is
        // retained for this pad. This is the audited fix — the next polling
        // frame can no longer overwrite a drift warning with "passed".
        if (active.length > 0 && !isCalibratingRef.current && !trackerRef.current.hasRetainedVerdict) {
          if (current) {
            // Token captured per frame: a stale frame's emission is rejected
            // if the run was reset meanwhile. Identical re-emissions dedupe in
            // the ResultController, so this stays cheap per frame.
            emitRunRich(currentRun(), {
              status: 'passed',
              details: `Controller connected: ${current.id}. Live button and axis polling works. Connection alone does not verify every button — press each control to observe it.`,
              metrics: { padId: current.id, buttonCount: current.buttons.length },
            });
          }
        }
      }

      animId = requestAnimationFrame(pollGamepads);
    };

    animId = requestAnimationFrame(pollGamepads);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
    };
  }, [selectedPadIndex, emitRunRich, currentRun]);

  // New device selection = new observation run: the old run's verdict must not
  // linger and a stale poll frame must not restore it. The UI mirror is
  // reconciled from the poll frame's identity-change branch.
  useEffect(() => {
    startRun();
    // Selection change also drops the calibration verdict of the old pad.
    trackerRef.current.invalidatePad(selectedPadIdRef.current);
  }, [selectedPadIndex, startRun]);

  // Neutral Drift Calibration Test (Observed 2.5 seconds while idle)
  const startNeutralCalibration = () => {
    const rawPads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() ?? [] : [];
    const pad = rawPads[selectedPadIndex] || rawPads[0];
    if (!pad) return;

    setIsCalibratingNeutral(true);
    setVerdictForPad(null);
    isCalibratingRef.current = true;
    // Open the sampling window for THIS pad; rAF frames feed it while open.
    // (Without this the window never opens and no samples can be collected.)
    trackerRef.current.beginNewCalibration(pad.id);
    selectedPadIdRef.current = pad.id;

    // Capture the token NOW (operation start): if the user switches device,
    // resets, or the component unmounts during calibration, this timeout's
    // completion belongs to a stale run and must not report.
    const runToken = currentRun();

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      isCalibratingRef.current = false;

      if (runToken !== currentRun()) {
        // Stale calibration (device changed / reset during the window):
        // discard silently — the newer run reports for itself.
        setIsCalibratingNeutral(false);
        return;
      }

      setIsCalibratingNeutral(false);

      const verdict = trackerRef.current.finish(10);
      if (!verdict) {
        // Not enough samples (pad vanished, background throttling): honest
        // inconclusive instead of silently passing.
        setVerdictForPad(null);
        emitRunRich(runToken, {
          status: 'inconclusive',
          details: 'Not enough idle samples were collected to assess stick centering. Keep the controller connected and try again.',
          metrics: { samplesCollected: 'low' },
        });
        return;
      }

      setVerdictForPad(trackerRef.current.snapshot()); // pad-bound verdict for the UI
      emitRunRich(runToken, {
        status: verdict.hasDrift ? 'warning' : 'passed',
        details: verdict.hasDrift
          ? `Idle stick resting offset exceeded this tool's ~${Math.round(DRIFT_THRESHOLD * 100)}% deadzone (Left: ${(verdict.maxLeft * 100).toFixed(1)}%, Right: ${(verdict.maxRight * 100).toFixed(1)}%). This is an approximate heuristic for this tester, not a universal certification.`
          : `Idle sticks rested within this tool's ~${Math.round(DRIFT_THRESHOLD * 100)}% neutral deadzone over the 2.5 s window.`,
        metrics: { maxLeftIdleOffset: verdict.maxLeft, maxRightIdleOffset: verdict.maxRight, threshold: DRIFT_THRESHOLD },
      });
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
  // The verdict shown for THIS controller only — never another pad's result.
  const activeVerdict =
    verdictForPad && activePad && verdictForPad.padId === activePad.id ? verdictForPad.verdict : null;

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
                <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-0.5">
                  Release both sticks and observe resting deadzone for 2.5 seconds.
                </p>
              </div>

              <button
                onClick={startNeutralCalibration}
                disabled={isCalibratingNeutral}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Crosshair className="w-3.5 h-3.5" />
                {isCalibratingNeutral
                  ? 'Measuring Idle Rest...'
                  : startButtonLabel ?? 'Run Neutral Check'}
              </button>
            </div>

            {activeVerdict !== null && (
              <div
                className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  activeVerdict.hasDrift
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {activeVerdict.hasDrift ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                )}
                <span>
                  {activeVerdict.hasDrift
                    ? `Resting stick position drifted outside this tool's ~${Math.round(DRIFT_THRESHOLD * 100)}% neutral deadzone — a warning, not a certification.`
                    : `Sticks rested stably within this tool's ~${Math.round(DRIFT_THRESHOLD * 100)}% neutral deadzone.`}
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
                        : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043]'
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
      <TestResultBanner result={result} onClear={clear} toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />

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
