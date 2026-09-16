'use client';

import React, { useState, useEffect } from 'react';
import { Gamepad2, AlertTriangle, CheckCircle, Crosshair } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface GamepadTesterProps {
  t: Translations;
  onRecordResult?: (result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive'; details: string; metrics?: Record<string, unknown> }) => void;
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
  const [gamepads, setGamepads] = useState<{ id: string; index: number; buttons: number[]; axes: number[] }[]>([]);
  const [selectedPadIndex, setSelectedPadIndex] = useState<number>(0);

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
          }
        }

        setGamepads(active);

        if (active.length > 0) {
          const current = active[0];
          const hasDrift = current.axes.some((ax) => Math.abs(ax) > 0.15);
          onRecordResult?.({
            status: hasDrift ? 'warning' : 'passed',
            details: `Controller detected: ${current.id}. ${hasDrift ? 'Possible stick drift detected.' : 'Neutral sticks verified.'}`,
            metrics: { padId: current.id, axes: current.axes },
          });
        }
      }

      animId = requestAnimationFrame(pollGamepads);
    };

    animId = requestAnimationFrame(pollGamepads);

    return () => cancelAnimationFrame(animId);
  }, []);

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
