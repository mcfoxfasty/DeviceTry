'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move3d, Play, Square, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { classifyAxes, hasFiniteReading, ReadingVerdict } from '@/lib/testing/sensorGates';

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

/** How long to wait for the first valid finite reading before an honest inconclusive. */
const FIRST_READING_TIMEOUT_MS = 5000;

export function AccelerometerTester({ onResultUpdate }: TesterProps) {
  const [listening, setListening] = useState<boolean>(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [receivedValid, setReceivedValid] = useState<boolean>(false);
  const [peak, setPeak] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const [iosPermissionPending, setIosPermissionPending] = useState<boolean>(false);

  // Immutable observation token: bumped on stop/restart/unmount so an event
  // arriving from an attached-then-detached listener cannot mutate state.
  const sessionTokenRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peakRef = useRef<number>(0);

  const reportResult = useCallback((ok: boolean) => {
    if (!ok) {
      onResultUpdate?.('unsupported', 'DeviceMotionEvent not exposed or permission denied');
      return;
    }
    onResultUpdate?.('inconclusive', 'Listening for the first finite accelerometer reading — attaching a listener alone is not proof the sensor works');
  }, [onResultUpdate]);

  const detachListener = useCallback(() => {
    window.ondevicemotion = null;
  }, []);

  const stopListening = useCallback(() => {
    sessionTokenRef.current += 1; // invalidate all in-flight callbacks
    detachListener();
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setListening(false);
  }, [detachListener]);

  // Unmount: full cleanup with no setState after teardown begins.
  useEffect(() => {
    return () => {
      sessionTokenRef.current += 1;
      window.ondevicemotion = null;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const attachAndListen = () => {
    const token = sessionTokenRef.current; // captured at attach time

    window.ondevicemotion = (event: DeviceMotionEvent) => {
      if (token !== sessionTokenRef.current) {
        return; // obsolete callback after stop/restart/unmount: ignore
      }
      const acc = event.accelerationIncludingGravity;
      const verdict: ReadingVerdict = classifyAxes({
        x: acc?.x,
        y: acc?.y,
        z: acc?.z,
      });

      if (verdict === 'missing-data') {
        // Nulls are MISSING data — never treated as zero or success.
        return;
      }
      if (verdict === 'non-finite') {
        return;
      }

      // verdict === 'valid': finite numbers (zero included — a device at
      // rest legitimately reads 0/0/0 on some axes; zero IS data).
      const r: Reading = {
        x: Math.round((acc!.x as number) * 100) / 100,
        y: Math.round((acc!.y as number) * 100) / 100,
        z: Math.round((acc!.z as number) * 100) / 100,
      };
      const magnitude = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
      setReading(r);
      setReceivedValid(true);
      if (magnitude > peakRef.current) {
        peakRef.current = magnitude;
        setPeak(Math.round(magnitude * 100) / 100);
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      onResultUpdate?.('passed', 'Finite 3-axis acceleration received (valid data, zero values included)');
    };

    // Bounded wait for the first valid reading.
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (token !== sessionTokenRef.current) return;
      if (!hasFiniteReadingRef.current) {
        setTimedOut(true);
        onResultUpdate?.(
          'inconclusive',
          'No finite accelerometer reading arrived within 5 s. The browser exposes DeviceMotionEvent but sent no usable data (common on desktops without an IMU or when the sensor is blocked).'
        );
      }
    }, FIRST_READING_TIMEOUT_MS);
  };

  // Ref mirror so the timeout callback reads live state without re-binding.
  const hasFiniteReadingRef = useRef<boolean>(false);
  useEffect(() => {
    hasFiniteReadingRef.current = receivedValid;
  }, [receivedValid]);

  const startListening = async () => {
    setError(null);
    setPeak(0);
    setReading(null);
    setReceivedValid(false);
    setTimedOut(false);
    peakRef.current = 0;

    stopListening(); // invalidate any previous session + detach
    sessionTokenRef.current += 1;

    const DME = window.DeviceMotionEvent as (typeof DeviceMotionEvent) & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (!('DeviceMotionEvent' in window)) {
      setError('DeviceMotionEvent is not available on this device — desktops without an IMU cannot stream motion data.');
      onResultUpdate?.('unsupported', 'DeviceMotionEvent unavailable');
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
          onResultUpdate?.('failed', 'Motion permission denied');
          return;
        }
      }
      attachAndListen();
      setListening(true);
      reportResult(true);
    } catch (err) {
      setIosPermissionPending(false);
      setError((err as Error).message || 'Failed to start motion sensor');
      onResultUpdate?.('failed', 'Accelerometer start failed');
    }
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
            onClick={() => {
              stopListening();
            }}
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
            Finite sensor data received — tilt or shake the device to see values react. A steady 0.00 is still
            valid data.
          </div>
        </div>
      ) : timedOut ? (
        <div className="mt-5 p-6 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No sensor data received</p>
            <p className="mt-1 opacity-80">
              The API exists but no finite reading arrived within 5 seconds. This device/browser combination
              appears not to deliver motion data — inconclusive, not a hardware failure verdict.
            </p>
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
        Values include gravity (accelerationIncludingGravity). A phone resting face-up reads ≈ −9.8 on the Z axis.
        Desktops without an IMU typically send nothing: that reports as inconclusive here, not as success.
      </div>
    </div>
  );
}
