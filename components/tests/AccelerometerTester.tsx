'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Move3d, Play, Square, CheckCircle, XCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface Reading {
  x: number;
  y: number;
  z: number;
}

export function AccelerometerTester({ onResultUpdate }: TesterProps) {
  const [listening, setListening] = useState<boolean>(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [peak, setPeak] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [iosPermissionPending, setIosPermissionPending] = useState<boolean>(false);
  const lastReadingRef = useRef<Reading | null>(null);

  useEffect(() => {
    return () => {
      window.ondevicemotion = null;
    };
  }, []);

  const reportResult = (ok: boolean) => {
    if (!ok) {
      onResultUpdate?.('unsupported', 'DeviceMotionEvent not exposed or permission denied');
      return;
    }
    onResultUpdate?.('passed', 'Accelerometer streaming live 3-axis acceleration');
  };

  const attachListener = () => {
    window.ondevicemotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const r: Reading = {
        x: Math.round((acc.x ?? 0) * 100) / 100,
        y: Math.round((acc.y ?? 0) * 100) / 100,
        z: Math.round((acc.z ?? 0) * 100) / 100,
      };
      lastReadingRef.current = r;
      const magnitude = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
      setReading(r);
      setPeak((p) => (magnitude > p ? Math.round(magnitude * 100) / 100 : p));
    };
  };

  const startListening = async () => {
    setError(null);
    setPeak(0);
    setReading(null);

    const DME = window.DeviceMotionEvent as (typeof DeviceMotionEvent) & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (!('DeviceMotionEvent' in window)) {
      setError('DeviceMotionEvent is not available on this device — desktops without an IMU cannot stream motion data.');
      reportResult(false);
      return;
    }

    try {
      // iOS 13+ requires an explicit user-gesture permission request.
      if (typeof DME.requestPermission === 'function') {
        setIosPermissionPending(true);
        const response = await DME.requestPermission();
        setIosPermissionPending(false);
        if (response !== 'granted') {
          setError('Motion sensor permission was denied. Enable it in Settings → Safari → Motion & Orientation Access.');
          reportResult(false);
          return;
        }
      }
      attachListener();
      setListening(true);
      reportResult(true);
    } catch (err) {
      setIosPermissionPending(false);
      setError((err as Error).message || 'Failed to start motion sensor');
      reportResult(false);
    }
  };

  const stopListening = () => {
    window.ondevicemotion = null;
    setListening(false);
  };

  const axisBar = (value: number) => {
    const clamped = Math.max(-20, Math.min(20, value));
    const pct = (Math.abs(clamped) / 20) * 50;
    return (
      <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-[#0B111A] overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400 dark:bg-[#31435D]" />
        <div
          className={`absolute top-0 bottom-0 rounded-full ${value >= 0 ? 'bg-[#0F766E]' : 'bg-red-500'}`}
          style={
            value >= 0
              ? { left: '50%', width: `${pct}%` }
              : { right: '50%', width: `${pct}%` }
          }
        />
      </div>
    );
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#D97706]/10 text-[#D97706] flex items-center justify-center">
            <Move3d className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Accelerometer &amp; Motion Test</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Live 3-axis acceleration including gravity vectors (m/s²)</p>
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
            disabled={iosPermissionPending}
            className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" /> {iosPermissionPending ? 'Awaiting permission…' : 'Start Motion Test'}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{error}</p>
            <p className="mt-1 opacity-80">Open this tool on a smartphone over HTTPS for sensor access.</p>
          </div>
        </div>
      )}

      {listening && reading ? (
        <div className="mt-5 space-y-4">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold uppercase text-[#5F6B7A] dark:text-[#9AA6B8]">Axis {axis.toUpperCase()}</span>
                <span className="font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4]">
                  {reading[axis].toFixed(2)} m/s²
                </span>
              </div>
              {axisBar(reading[axis])}
            </div>
          ))}

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
              <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Total magnitude</p>
              <p className="font-mono-num text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">
                {Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2).toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
              <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Peak recorded</p>
              <p className="font-mono-num text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">{peak.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-center">
              <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Flat on table ≈ Z</p>
              <p className="font-mono-num text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">±9.8</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            Accelerometer streaming — tilt or shake the device to see values react.
          </div>
        </div>
      ) : !error ? (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <Move3d className="w-10 h-10 mx-auto opacity-40 text-[#5F6B7A] mb-2" />
          <p className="text-sm font-medium text-[#5F6B7A] dark:text-[#9AA6B8]">
            Press Start Motion Test and tilt your phone. iOS will prompt for explicit motion permission.
          </p>
        </div>
      ) : null}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        Values include gravity (accelerationIncludingGravity). A phone resting face-up reads ≈ −9.8 on the Z axis. Desktops without an IMU report nothing.
      </div>
    </div>
  );
}
