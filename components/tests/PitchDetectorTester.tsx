'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import {
  autoCorrelate,
  buildPitchMeasurement,
  classifyPitchStartError,
  deriveChromaticReading,
  PITCH_RANGE_MIN_HZ,
  PITCH_RANGE_MAX_HZ,
} from '@/lib/testing/pitchMath';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured' | 'unsupported',
    details?: string
  ) => void;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
  onResultClear?: () => void;
  /** Guided inspection: a refused permission or absent device is blocked, not failed hardware. */
  onPermissionBlocked?: (reason: 'denied' | 'unavailable') => void;
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
}

export function PitchDetectorTester({
  onResultUpdate,
  onRecordResult,
  onResultClear,
  onPermissionBlocked,
  toolId,
  toolTitle,
  toolSlug,
}: ToolComponentProps) {
  const { result, emitRunRich, clear, startRun, invalidate, currentRun } = useTestResult({
    onResultUpdate,
    onRecordResult,
    onResultClear,
  });
  const [isListening, setIsListening] = useState<boolean>(false);
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteName, setNoteName] = useState<string>('--');
  const [octave, setOctave] = useState<number | null>(null);
  const [cents, setCents] = useState<number>(0);
  const [stale, setStale] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const unmountedRef = useRef<boolean>(false);
  const lastSignalStateRef = useRef<'none' | 'usable' | 'stale'>('none');
  const lastEmissionAtRef = useRef<number>(0);

  const stopListening = useCallback(() => {
    invalidate();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
  }, [invalidate]);

  // Function declaration keeps the animation loop self-reference valid. The
  // run token travels with the callback so a late frame cannot restore a
  // result from an older listening attempt.
  function updatePitch(runToken: number) {
    if (unmountedRef.current || runToken !== currentRun() || !analyserRef.current || !audioCtxRef.current) return;
    const buf = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buf);

    const detected = autoCorrelate(buf, audioCtxRef.current.sampleRate);
    const now = Date.now();
    const isUsable =
      detected !== null &&
      detected.freq > PITCH_RANGE_MIN_HZ &&
      detected.freq < PITCH_RANGE_MAX_HZ &&
      detected.confidence > 0.85;

    if (isUsable && detected) {
      const reading = deriveChromaticReading(detected.freq);
      setPitch(Math.round(detected.freq * 10) / 10);
      setNoteName(reading.name);
      setOctave(reading.octave);
      setCents(Math.max(-50, Math.min(50, Math.round(reading.cents))));
      setStale(false);

      // The live dial updates every frame, but the shared verdict is throttled
      // so normal pitch jitter does not create an unbounded result stream.
      if (lastSignalStateRef.current !== 'usable' || now - lastEmissionAtRef.current >= 250) {
        const measurement = buildPitchMeasurement(detected.freq, detected.confidence);
        emitRunRich(runToken, { status: 'measured', ...measurement });
        lastEmissionAtRef.current = now;
      }
      lastSignalStateRef.current = 'usable';
    } else {
      setPitch(null);
      setNoteName('--');
      setOctave(null);
      setCents(0);
      setStale(true);
      if (lastSignalStateRef.current !== 'stale') {
        emitRunRich(runToken, {
          status: 'inconclusive',
          details:
            'No usable pitch signal was detected. Play or sing a clear, sustained note near the microphone; silence or an unclear signal cannot verify a pitch.',
        });
      }
      lastSignalStateRef.current = 'stale';
    }
    rafRef.current = requestAnimationFrame(() => updatePitch(runToken));
  }

  const startListening = async () => {
    stopListening();
    const runToken = startRun();
    setErrorMsg(null);
    setStale(false);
    lastSignalStateRef.current = 'none';
    lastEmissionAtRef.current = 0;

    // Starting a new attempt is itself an honest incomplete observation until
    // a confident, in-range frequency arrives.
    emitRunRich(runToken, {
      status: 'inconclusive',
      details: 'Pitch detector is listening. Play or sing a clear, sustained note to produce a measurement.',
    });

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not expose microphone capture.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });

      if (unmountedRef.current || runToken !== currentRun()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      streamRef.current = stream;
      setIsListening(true);
      rafRef.current = requestAnimationFrame(() => updatePitch(runToken));
    } catch (err: unknown) {
      if (unmountedRef.current || runToken !== currentRun()) return;
      const error = err as Error;
      const block = classifyPitchStartError(error);
      if (block === 'denied' || block === 'unavailable') {
        const details = block === 'denied'
          ? 'Microphone permission was denied. The microphone was not tested; allow access for this site and retry.'
          : 'No microphone device was found. The hardware was not tested; connect or enable a microphone and retry.';
        setErrorMsg(details);
        emitRunRich(runToken, { status: 'unsupported', details });
        onPermissionBlocked?.(block);
        return;
      }

      setErrorMsg('Pitch capture could not start in this browser. No microphone measurement was made.');
      emitRunRich(runToken, {
        status: 'inconclusive',
        details: 'Pitch capture could not start in this browser. No microphone measurement was made.',
      });
    }
  };

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopListening();
    };
  }, [stopListening]);

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Pitch Dial Board */}
      <div className="p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col items-center justify-center text-center space-y-6">
        {!isListening ? (
          <div className="space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] flex items-center justify-center mx-auto">
              <Mic className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#172033] dark:text-[#E9EEF4]">Acoustic Pitch Detector</h3>
              <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-1">
                Sing or play a note into your microphone to analyze live frequency and note names.
              </p>
            </div>
            <button
              onClick={startListening}
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm"
            >
              Start Listening
            </button>
          </div>
        ) : (
          <div className="space-y-6 w-full max-w-md">
            <div className="flex flex-col items-center">
              <div className="flex items-baseline justify-center gap-1 font-extrabold text-[#172033] dark:text-[#E9EEF4]">
                <span className={`text-7xl tracking-tighter ${stale ? 'opacity-50' : ''}`}>{noteName}</span>
                {octave !== null && <span className="text-3xl text-[#0F766E]">{octave}</span>}
              </div>
              <div className="font-mono text-sm text-[#59677D] dark:text-[#9AA6B8] mt-1">
                {pitch !== null && !stale ? `${pitch.toFixed(1)} Hz` : stale ? 'Signal lost — awaiting reliable audio…' : 'Listening for audio signal...'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono font-semibold text-[#59677D] dark:text-[#9AA6B8]">
                <span>-50 Flat</span>
                <span className={Math.abs(cents) <= 5 ? 'text-emerald-600 font-bold' : ''}>
                  {cents > 0 ? `+${cents}` : cents} cents
                </span>
                <span>+50 Sharp</span>
              </div>
              <div className="relative h-3 w-full bg-[#DFE5EB] dark:bg-[#223043] rounded-full overflow-hidden">
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400 dark:bg-slate-500 z-10" />
                <div
                  className={`absolute top-0 bottom-0 w-2 rounded-full transition-all duration-75 ${stale ? 'bg-slate-400 opacity-40' : Math.abs(cents) <= 5 ? 'bg-emerald-500 shadow-xs' : cents < 0 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ left: `${Math.max(5, Math.min(95, 50 + cents))}%`, transform: 'translateX(-50%)' }}
                />
              </div>
            </div>

            <p className="text-[11px] text-[#8996A6] dark:text-[#677589] leading-relaxed">
              Browser-estimated fundamental, not a calibrated tuner. The measurement remains after Stop.
            </p>

            <button
              onClick={stopListening}
              className="px-5 py-2.5 bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-red-500 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MicOff className="w-3.5 h-3.5 text-red-500" />
              Stop Listening
            </button>
          </div>
        )}
      </div>

      <TestResultBanner result={result} onClear={clear} toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />
    </div>
  );
}
