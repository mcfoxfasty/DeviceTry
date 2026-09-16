'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Play, Square, CheckCircle, XCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface Orientation {
  alpha: number; // compass heading 0-360
  beta: number; // front/back tilt -180..180
  gamma: number; // left/right tilt -90..90
}

export function GyroscopeTester({ onResultUpdate }: TesterProps) {
  const [listening, setListening] = useState<boolean>(false);
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [absolute, setAbsolute] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      window.ondeviceorientation = null;
    };
  }, []);

  const startListening = async () => {
    setError(null);

    const DOE = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent) & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (!('DeviceOrientationEvent' in window)) {
      setError('DeviceOrientationEvent is not available — this device has no orientation sensor or the browser blocks it.');
      onResultUpdate?.('unsupported', 'DeviceOrientationEvent unavailable');
      return;
    }

    try {
      if (typeof DOE.requestPermission === 'function') {
        const response = await DOE.requestPermission();
        if (response !== 'granted') {
          setError('Orientation permission was denied. Enable Motion & Orientation Access in Safari settings.');
          onResultUpdate?.('failed', 'Orientation permission denied');
          return;
        }
      }
      window.ondeviceorientation = (event: DeviceOrientationEvent) => {
        if (event.alpha === null && event.beta === null && event.gamma === null) return;
        setOrientation({
          alpha: Math.round((event.alpha ?? 0) * 10) / 10,
          beta: Math.round((event.beta ?? 0) * 10) / 10,
          gamma: Math.round((event.gamma ?? 0) * 10) / 10,
        });
        setAbsolute(event.absolute === true);
      };
      setListening(true);
      onResultUpdate?.('passed', 'Gyroscope streaming alpha/beta/gamma orientation');
    } catch (err) {
      setError((err as Error).message || 'Failed to start orientation sensor');
      onResultUpdate?.('failed', 'Gyroscope start failed');
    }
  };

  const stopListening = () => {
    window.ondeviceorientation = null;
    setListening(false);
  };

  const angleRow = (label: string, description: string, value: number) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
      <div>
        <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4]">{label}</p>
        <p className="text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8]">{description}</p>
      </div>
      <p className="font-mono-num text-lg font-black text-[#0F766E] dark:text-[#14B8A6]">{value.toFixed(1)}°</p>
    </div>
  );

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#D97706]/10 text-[#D97706] flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Gyroscope &amp; Orientation Test</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Alpha / Beta / Gamma rotation with live 3D tilt preview</p>
          </div>
        </div>
        {listening ? (
          <button
            onClick={stopListening}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" /> Stop Sensors
          </button>
        ) : (
          <button
            onClick={startListening}
            className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> Enable Orientation Sensors
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{error}</p>
            <p className="mt-1 opacity-80">Open this tool on a smartphone over HTTPS to access orientation sensors.</p>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* 3D phone preview */}
        <div className="p-6 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center justify-center min-h-[240px]">
          <div style={{ perspective: '700px' }}>
            <div
              className="w-24 h-44 rounded-2xl border-4 border-[#D97706] bg-white dark:bg-[#111D30] shadow-xl transition-transform duration-150 relative"
              style={{
                transform: orientation
                  ? `rotateX(${-orientation.beta}deg) rotateY(${orientation.gamma}deg) rotateZ(${orientation.alpha}deg)`
                  : 'none',
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1.5 rounded-full bg-[#D97706]/40" />
              <div className="absolute inset-x-3 top-8 bottom-3 rounded-lg bg-[#D97706]/10" />
            </div>
          </div>
        </div>

        {/* Angle readouts */}
        <div className="space-y-3">
          {orientation ? (
            <>
              {angleRow('Alpha (α)', 'Compass heading around the Z axis', orientation.alpha)}
              {angleRow('Beta (β)', 'Front ↔ back pitch around the X axis', orientation.beta)}
              {angleRow('Gamma (γ)', 'Left ↔ right roll around the Y axis', orientation.gamma)}
              <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                {absolute ? 'Absolute (magnetometer-anchored) orientation reported' : 'Relative orientation (no compass anchor)'}
              </p>
            </>
          ) : (
            <div className="p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center h-full flex flex-col items-center justify-center">
              <Compass className="w-8 h-8 mx-auto opacity-40 text-[#5F6B7A] mb-2" />
              <p className="text-sm font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
                Enable sensors and rotate your device — the 3D phone mirrors its tilt in real time.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        Calibrate a drifting compass by moving the phone in a figure-8. Absolute (true-north) heading requires a magnetometer and can be disturbed indoors by magnets or electronics.
      </div>
    </div>
  );
}
