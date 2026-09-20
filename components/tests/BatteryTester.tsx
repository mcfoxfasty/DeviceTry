'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Battery, BatteryCharging, AlertCircle, CheckCircle, Zap, RotateCcw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import {
  BatterySubscriptionController,
  BatterySnapshotLike,
  BatterySource,
} from '@/lib/testing/batterySubscription';

interface BatteryTesterProps {
  t: Translations;
  onRecordResult?: (result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported'; details: string; metrics?: Record<string, unknown> }) => void;
  onResultClear?: () => void;
}

interface BatteryManager {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

export function BatteryTester({ t, onRecordResult, onResultClear }: BatteryTesterProps) {
  const { result, emitRunRich, clear, invalidate, startRun, currentRun } = useTestResult({
    onRecordResult,
    onResultClear,
  });
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);
  const [chargingTime, setChargingTime] = useState<number | null>(null);
  const [dischargingTime, setDischargingTime] = useState<number | null>(null);

  // Live subscription controller instance (created in the mount effect).
  const controllerRef = useRef<BatterySubscriptionController | null>(null);
  // Version counter bumped by clear/refresh so the mount effect can
  // re-subscribe with a fresh token without remounting the component.
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);

  // Subscribe (and re-subscribe after a clear/refresh). Each subscription
  // captures its token at subscribe time; events validate that captured token,
  // so old-listener events stay rejected while fresh events report again.
  useEffect(() => {
    const nav = navigator as unknown as { getBattery?: () => Promise<BatteryManager> };
    let cancelled = false;
    let controller: BatterySubscriptionController | null = null;

    const initBattery = async () => {
      // Capture the token NOW (operation start), never inside the promise.
      const runToken = currentRun();

      if (!nav.getBattery) {
        if (cancelled) return;
        setIsSupported(false);
        emitRunRich(runToken, {
          status: 'unsupported',
          details: 'Battery Status API is not exposed by this browser engine.',
        });
        return;
      }

      try {
        const battery = await nav.getBattery();
        if (cancelled || runToken !== currentRun()) {
          return;
        }

        const source: BatterySource = {
          read: () => ({
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
          }),
          addEventListener: (type, listener) => battery.addEventListener(type, listener as EventListener),
          removeEventListener: (type, listener) => battery.removeEventListener(type, listener as EventListener),
        };

        controller = new BatterySubscriptionController(
          source,
          {
            onEvent: (token, snapshot: BatterySnapshotLike) => {
              if (cancelled || token !== currentRun()) return;
              const currentLevel = Math.round(snapshot.level * 100);
              setLevel(currentLevel);
              setIsCharging(snapshot.charging);
              setChargingTime(snapshot.chargingTime);
              setDischargingTime(snapshot.dischargingTime);

              emitRunRich(token, {
                status: 'passed',
                details: `Battery level: ${currentLevel}%, Charging: ${snapshot.charging ? 'Yes' : 'No'}`,
                metrics: { levelPercent: currentLevel, charging: snapshot.charging },
              });
            },
            onSuperseded: () => {
              // No lifecycle action here: refreshReading() has already called
              // startRun() BEFORE controller.refresh(token), so the visible
              // verdict and host/guided result were cleared exactly once.
              // Calling startRun() here would double-bump the token.
            },
          },
          runToken
        );

        controller.subscribe(runToken);
        controllerRef.current = controller;
        if (cancelled) {
          // Unmount raced the subscription: tear down immediately.
          controller.unsubscribeAll();
          controllerRef.current = null;
          return;
        }
        setIsSupported(true);
      } catch {
        if (!cancelled) setIsSupported(false);
      }
    };

    initBattery();

    return () => {
      cancelled = true;
      // Remove ALL listeners. Pure teardown: does not touch tokens, does not
      // clear the completed guided result.
      if (controller) {
        controller.unsubscribeAll();
      }
      controllerRef.current = null;
      // Unmount/version-bump invalidation: in-flight getBattery resolutions
      // from older versions can no longer report.
      invalidate();
    };
  }, [subscriptionVersion, currentRun, emitRunRich, startRun, invalidate]);

  /**
   * Clearing the result starts a genuinely new observation: the stale entry
   * is dropped from the host, a fresh token is captured, and the battery is
   * re-subscribed — so later battery events produce NEW results again
   * (previously clearing permanently invalidated reporting).
   */
  const handleClearAndRefresh = useCallback(() => {
    startRun(); // clears visible verdict + host/guided result exactly once
    setSubscriptionVersion((v) => v + 1); // re-subscribe with a fresh token
  }, [startRun]);

  const refreshReading = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    // ONE lifecycle transition: startRun() clears the visible verdict and the
    // host/guided result exactly once and returns the fresh immutable token;
    // the controller re-subscribes its listeners bound to THAT token. Old
    // listeners stay rejected; fresh battery events report again.
    const token = startRun();
    controller.refresh(token);
  }, [startRun]);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Battery className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.batteryTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.batteryTest.shortDesc}</p>
        </div>

        {isSupported === true && (
          <div className="flex items-center gap-2">
            <button
              id="btn-refresh-battery"
              onClick={refreshReading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#E6F4F2] text-[#142033] dark:text-[#E9EEF4] text-xs font-medium rounded-md border border-[#DFE5EB] dark:border-[#223043] transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Refresh Reading
            </button>
            <button
              id="btn-reset-battery"
              onClick={handleClearAndRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F7F9] dark:bg-[#192332] hover:bg-[#E6F4F2] text-[#142033] dark:text-[#E9EEF4] text-xs font-medium rounded-md border border-[#DFE5EB] dark:border-[#223043] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        )}
      </div>

      {isSupported === true ? (
        <div className="mt-6 space-y-6">
          {/* Main Battery Meter Display */}
          <div className="p-6 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                {isCharging ? (
                  <BatteryCharging className="w-14 h-14 text-[#0F766E] dark:text-[#14B8A6]" />
                ) : (
                  <Battery className="w-14 h-14 text-[#142033] dark:text-[#E9EEF4]" />
                )}
              </div>

              <div>
                <div className="text-3xl font-bold font-mono-num text-[#142033] dark:text-[#E9EEF4]">
                  {level !== null ? `${level}%` : '—'}
                </div>
                <div className="text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 flex items-center gap-1.5">
                  {isCharging ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-500 fill-current" />
                      <span>{t.batteryTest.charging}</span>
                    </>
                  ) : (
                    <span>{t.batteryTest.discharging}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Gauge progress bar */}
            <div className="w-full sm:w-64">
              <div className="w-full h-3 bg-white dark:bg-[#131B27] rounded-full overflow-hidden border border-[#DFE5EB] dark:border-[#223043]">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    (level || 0) < 20 ? 'bg-red-500' : (level || 0) < 50 ? 'bg-amber-500' : 'bg-[#0F766E] dark:bg-[#14B8A6]'
                  }`}
                  style={{ width: `${level || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Time metrics if available */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-[#F6F7F9] dark:bg-[#192332] rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
              <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.batteryTest.chargingTime}: </span>
              <span className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
                {chargingTime && chargingTime !== Infinity ? `${Math.round(chargingTime / 60)} mins` : 'N/A'}
              </span>
            </div>

            <div className="p-3 bg-[#F6F7F9] dark:bg-[#192332] rounded-lg border border-[#DFE5EB] dark:border-[#223043]">
              <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.batteryTest.dischargingTime}: </span>
              <span className="font-semibold text-[#142033] dark:text-[#E9EEF4]">
                {dischargingTime && dischargingTime !== Infinity ? `${Math.round(dischargingTime / 60)} mins` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      ) : isSupported === false ? (
        <div className="mt-6 p-6 rounded-lg bg-slate-50 dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">
                {t.batteryTest.unsupportedTitle}
              </p>
              <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1.5 leading-relaxed">
                {t.batteryTest.unsupportedText}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Checking battery status...</p>
        </div>
      )}

      {/* Test result — in-card. Clearing now refreshes the subscription instead
          of permanently invalidating it. */}
      <TestResultBanner result={result} onClear={handleClearAndRefresh} />

      {/* Strict Battery Health Disclaimer Required by User Prompt */}
      <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Notice:</strong> {t.batteryTest.healthDisclaimer}
        </p>
      </div>

      {/* Troubleshooting & Interpretation */}
      <div className="mt-6 pt-5 border-t border-[#DFE5EB] dark:border-[#223043] text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
          {t.batteryTest.interpretationTitle}
        </h3>
        <p className="leading-relaxed">{t.batteryTest.interpretationText}</p>
      </div>
    </div>
  );
}
