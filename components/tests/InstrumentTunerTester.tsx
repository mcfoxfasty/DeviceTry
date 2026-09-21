'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import {
  autoCorrelate,
  deriveChromaticReading,
  frequencyFromMidiNote,
  nearestMidiNote,
  centsOffFromNote,
  noteLabel,
  PITCH_RANGE_MIN_HZ,
  PITCH_RANGE_MAX_HZ,
} from '@/lib/testing/pitchMath';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

interface TunerTarget {
  name: string;
  freq: number | null; // null = chromatic (derive from detected pitch)
}

const INSTRUMENT_PRESETS: { name: string; strings: TunerTarget[] }[] = [
  {
    name: 'Guitar (Standard EADGBE)',
    strings: [
      { name: 'E2', freq: 82.41 },
      { name: 'A2', freq: 110.0 },
      { name: 'D3', freq: 146.83 },
      { name: 'G3', freq: 196.0 },
      { name: 'B3', freq: 246.94 },
      { name: 'E4', freq: 329.63 },
    ],
  },
  {
    name: 'Bass (Standard EADG)',
    strings: [
      { name: 'E1', freq: 41.2 },
      { name: 'A1', freq: 55.0 },
      { name: 'D2', freq: 73.42 },
      { name: 'G2', freq: 98.0 },
    ],
  },
  {
    name: 'Ukulele (GCEA)',
    strings: [
      { name: 'G4', freq: 392.0 },
      { name: 'C4', freq: 261.63 },
      { name: 'E4', freq: 329.63 },
      { name: 'A4', freq: 440.0 },
    ],
  },
  {
    name: 'Violin (GDAE)',
    strings: [
      { name: 'G3', freq: 196.0 },
      { name: 'D4', freq: 293.66 },
      { name: 'A4', freq: 440.0 },
      { name: 'E5', freq: 659.25 },
    ],
  },
  {
    name: 'Chromatic (All Notes)',
    strings: [{ name: 'Chromatic', freq: null }],
  },
];

export function InstrumentTunerTester({ onResultUpdate }: ToolComponentProps) {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [targetString, setTargetString] = useState<string>('A4');
  const [targetFreq, setTargetFreq] = useState<number>(440);
  const [centsOffset, setCentsOffset] = useState<number>(0);
  const [inTune, setInTune] = useState<boolean>(false);
  const [isChromatic, setIsChromatic] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stale, setStale] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Live settings mirrors: the rAF analysis loop reads these refs, so a
  // preset/string/frequency change made DURING an active run takes effect on
  // the very next analysis frame — no loop restart, no stale closure, and
  // exactly one analysis loop for the component's lifetime.
  const presetRef = useRef<number>(0);
  const targetRef = useRef<TunerTarget>({ name: 'A4', freq: 440 });

  const applyTarget = useCallback((target: TunerTarget) => {
    targetRef.current = target;
    setIsChromatic(target.freq === null);
    setTargetString(target.name);
    if (target.freq !== null) {
      setTargetFreq(target.freq);
    }
  }, []);

  const stopListening = useCallback(() => {
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
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // Hoisted function declaration: the rAF loop must reference itself.
  // Settings come from refs (updated live); the loop is started ONCE per
  // listening session and is never recreated for a settings change.
  function evaluatePitch() {
    if (!analyserRef.current || !audioCtxRef.current) return;
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    const detected = autoCorrelate(buf, ctx.sampleRate);
    const target = targetRef.current;
    const preset = INSTRUMENT_PRESETS[presetRef.current];

    if (detected && detected.freq > PITCH_RANGE_MIN_HZ && detected.freq < PITCH_RANGE_MAX_HZ) {
      setDetectedPitch(Math.round(detected.freq * 10) / 10);
      setStale(false);

      if (target.freq === null) {
        // GENUINE chromatic mode: derive the nearest equal-tempered note from
        // the DETECTED pitch — never an instrument preset's target.
        const reading = deriveChromaticReading(detected.freq);
        setTargetString(`${reading.name}${reading.octave}`);
        setTargetFreq(reading.targetHz);
        const cents = reading.cents;
        setCentsOffset(Math.max(-50, Math.min(50, cents)));
        setInTune(Math.abs(cents) <= 4);
      } else {
        // Instrument mode: measure against the selected string's target.
        setTargetFreq(target.freq);
        const cents = centsOffFromNote(detected.freq, nearestMidiNote(target.freq));
        setCentsOffset(Math.max(-50, Math.min(50, Math.round(cents))));
        setInTune(Math.abs(cents) <= 4);
      }
    } else {
      // Silent, weak, or unreliable signal: clear the stale readings so old
      // numbers are never displayed as if they were current.
      setDetectedPitch(null);
      setStale(true);
      setInTune(false);
    }
    void preset; // preset identity read via presetRef keeps this closure honest

    rafRef.current = requestAnimationFrame(evaluatePitch);
  }

  const startListening = async () => {
    setErrorMsg(null);
    stopListening();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });

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

      // Exactly one analysis loop per session.
      rafRef.current = requestAnimationFrame(evaluatePitch);

      onResultUpdate?.('inconclusive', 'Tuner engine listening — no pitch verdict until a confident note is detected');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Microphone access denied or unavailable');
      onResultUpdate?.('failed', error.message);
    }
  };

  const selectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    presetRef.current = idx;
    const preset = INSTRUMENT_PRESETS[idx];
    if (preset.strings.length > 0) {
      applyTarget(preset.strings[0]);
    }
  };

  const selectString = (target: TunerTarget) => {
    applyTarget(target);
  };

  const activePreset = INSTRUMENT_PRESETS[selectedPresetIndex];

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Preset Instrument Selector */}
      <div className="flex flex-wrap gap-2 justify-center">
        {INSTRUMENT_PRESETS.map((p, idx) => (
          <button
            key={p.name}
            onClick={() => selectPreset(idx)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              selectedPresetIndex === idx
                ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-xs'
                : 'bg-white dark:bg-[#111D30] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* String target selector (hidden in chromatic mode) */}
      {activePreset.strings.length > 1 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {activePreset.strings.map((s) => (
            <button
              key={`${s.name}-${s.freq}`}
              onClick={() => selectString(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                targetString === s.name && !isChromatic
                  ? 'bg-[#0F766E] text-white border-[#0D665F]'
                  : 'bg-white dark:bg-[#111D30] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
              }`}
            >
              {s.name} · {s.freq} Hz
            </button>
          ))}
        </div>
      )}

      {/* Main Tuner Dial View */}
      <div className="p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col items-center justify-center text-center space-y-6">
        {!isListening ? (
          <div className="space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] flex items-center justify-center mx-auto">
              <Mic className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#172033] dark:text-[#E9EEF4]">Acoustic Instrument Tuner</h3>
              <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-1">
                Pluck a string on your instrument to tune with precision cent feedback.
              </p>
            </div>
            <button
              onClick={startListening}
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm"
            >
              Start Tuner
            </button>
          </div>
        ) : (
          <div className="space-y-6 w-full max-w-md">
            {/* Target Note Display */}
            <div className="flex flex-col items-center">
              <div
                className={`text-7xl font-black tracking-tighter transition-colors ${
                  !stale && inTune ? 'text-emerald-600 dark:text-emerald-400' : stale ? 'text-[#8996A6] opacity-50' : 'text-[#172033] dark:text-[#E9EEF4]'
                }`}
              >
                {targetString}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {stale ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold">
                    SIGNAL LOST — reading cleared
                  </span>
                ) : !stale && inTune ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">
                    IN TUNE
                  </span>
                ) : (
                  <span className="text-xs text-[#59677D] dark:text-[#9AA6B8] font-mono">
                    {isChromatic ? 'Nearest note target' : 'Target'}: {targetFreq} Hz
                  </span>
                )}
                {detectedPitch && !stale && (
                  <span className="text-xs text-[#59677D] dark:text-[#9AA6B8] font-mono">
                    • Live: {detectedPitch} Hz
                  </span>
                )}
              </div>
            </div>

            {/* Analog Meter Needle */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono font-semibold text-[#59677D] dark:text-[#9AA6B8]">
                <span>Flat (Too Low)</span>
                <span className={!stale && inTune ? 'text-emerald-600 font-bold' : ''}>
                  {centsOffset > 0 ? `+${centsOffset}` : centsOffset} cents
                </span>
                <span>Sharp (Too High)</span>
              </div>

              <div className="relative h-4 w-full bg-[#DFE5EB] dark:bg-[#223043] rounded-full overflow-hidden">
                <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-emerald-600 z-10 -translate-x-1/2" />
                <div
                  className={`absolute top-0 bottom-0 w-3 rounded-full transition-all duration-75 ${
                    stale ? 'bg-slate-400 opacity-40' : inTune ? 'bg-emerald-500 shadow-sm' : centsOffset < 0 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{
                    left: `${Math.max(5, Math.min(95, 50 + centsOffset))}%`,
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>
            </div>

            <button
              onClick={stopListening}
              className="px-5 py-2.5 bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-red-500 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MicOff className="w-3.5 h-3.5 text-red-500" />
              Stop Tuner
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-[#8996A6]">
        Analysis range: ≈{PITCH_RANGE_MIN_HZ}–{PITCH_RANGE_MAX_HZ} Hz (limited by the {`2048`}-sample autocorrelation window at your device&apos;s sample rate). Chromatic mode derives the nearest equal-tempered note from the detected pitch — it does not read a preset string. All analysis is local to your browser.
      </p>
    </div>
  );
}

// Re-exported for consumers/tests that need the shared math.
export { frequencyFromMidiNote, noteLabel };
