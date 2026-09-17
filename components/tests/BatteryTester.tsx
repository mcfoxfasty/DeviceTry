'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Battery, BatteryCharging, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';

interface BatteryTesterProps {
  t: Translations;
  onRecordResult?: (result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported'; details: string; metrics?: Record<string, unknown> }) => void;
}

interface BatteryManager {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

export function BatteryTester({ t, onRecordResult }: BatteryTesterProps) {
  const { result, emitRich, clear } = useTestResult({ onRecordResult });
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);
  const [chargingTime, setChargingTime] = useState<number | null>(null);
  const [dischargingTime, setDischargingTime] = useState<number | null>(null);

  const onRecordResultRef = useRef(onRecordResult);
  useEffect(() => {
    onRecordResultRef.current = onRecordResult;
  }, [onRecordResult]);

  useEffect(() => {
    let batteryManager: BatteryManager | null = null;

    const initBattery = async () => {
      const nav = navigator as unknown as { getBattery?: () => Promise<BatteryManager> };

      if (!nav.getBattery) {
        setIsSupported(false);
        onRecordResultRef.current?.({
          status: 'unsupported',
          details: 'Battery Status API is not exposed by this browser engine.',
        });
        emitRich({
          status: 'unsupported',
          details: 'Battery Status API is not exposed by this browser engine.',
        });
        return;
      }

      try {
        const battery = await nav.getBattery();
        batteryManager = battery;
        setIsSupported(true);

        const updateStatus = () => {
          const currentLevel = Math.round(battery.level * 100);
          setLevel(currentLevel);
          setIsCharging(battery.charging);
          setChargingTime(battery.chargingTime);
          setDischargingTime(battery.dischargingTime);

          emitRich({
            status: 'passed',
            details: `Battery level: ${currentLevel}%, Charging: ${battery.charging ? 'Yes' : 'No'}`,
            metrics: {
              levelPercent: currentLevel,
              charging: battery.charging,
            },
          });
        };

        updateStatus();

        battery.addEventListener('chargingchange', updateStatus);
        battery.addEventListener('levelchange', updateStatus);
        battery.addEventListener('chargingtimechange', updateStatus);
        battery.addEventListener('dischargingtimechange', updateStatus);
      } catch {
        setIsSupported(false);
      }
    };

    initBattery();

    return () => {
      // cleanup listeners
    };
  }, []);

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

      {/* Test result — in-card, directly under the test area */}
      <TestResultBanner result={result} onClear={clear} />

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
