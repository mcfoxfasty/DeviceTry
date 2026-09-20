'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

const INSTRUMENT_PRESETS = [
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
    strings: [],
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Hoisted function declaration: the rAF loop must reference itself, and a
  // declaration is initialized before any code runs (unlike a const useCallback
  // self-reference, which accesses the variable before initialization).
  function evaluatePitch() {
    if (!analyserRef.current || !audioCtxRef.current) return;
    const buf = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buf);

    // Simple robust autocorrelation
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);

    if (rms > 0.02) {
      let r1 = 0;
      let r2 = buf.length - 1;
      for (let i = 0; i < buf.length / 2; i++) {
        if (Math.abs(buf[i]) < 0.2) {
          r1 = i;
          break;
        }
      }
      for (let i = 1; i < buf.length / 2; i++) {
        if (Math.abs(buf[buf.length - i]) < 0.2) {
          r2 = buf.length - i;
          break;
        }
      }

      const trimmed = buf.slice(r1, r2);
      const c = new Array(trimmed.length).fill(0);
      for (let i = 0; i < trimmed.length; i++) {
        for (let j = 0; j < trimmed.length - i; j++) {
          c[i] = c[i] + trimmed[j] * trimmed[j + i];
        }
      }

      let d = 0;
      while (c[d] > c[d + 1]) d++;
      let maxval = -1;
      let maxpos = -1;
      for (let i = d; i < trimmed.length; i++) {
        if (c[i] > maxval) {
          maxval = c[i];
          maxpos = i;
        }
      }

      const freq = audioCtxRef.current.sampleRate / maxpos;
      if (freq > 30 && freq < 1200) {
        setDetectedPitch(Math.round(freq * 10) / 10);

        // Find nearest string or calculate relative cents
        const activePreset = INSTRUMENT_PRESETS[selectedPresetIndex];
        let target = targetFreq;
        let noteName = targetString;

        if (activePreset.strings.length > 0) {
          let minDiff = Infinity;
          for (const s of activePreset.strings) {
            const diff = Math.abs(freq - s.freq);
            if (diff < minDiff) {
              minDiff = diff;
              target = s.freq;
              noteName = s.name;
            }
          }
        }

        setTargetString(noteName);
        setTargetFreq(target);
        const cents = Math.floor((1200 * Math.log(freq / target)) / Math.log(2));
        setCentsOffset(Math.max(-50, Math.min(50, cents)));
        setInTune(Math.abs(cents) <= 4);
      }
    }
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

      rafRef.current = requestAnimationFrame(evaluatePitch);

      if (onResultUpdate) {
        onResultUpdate('passed', 'Tuner engine listening');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Microphone access denied or unavailable');
      if (onResultUpdate) {
        onResultUpdate('failed', error.message);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

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
            onClick={() => {
              setSelectedPresetIndex(idx);
              if (p.strings.length > 0) {
                setTargetString(p.strings[0].name);
                setTargetFreq(p.strings[0].freq);
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              selectedPresetIndex === idx
                ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-xs'
                : 'bg-white dark:bg-[#111D30] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

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
                  inTune ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#172033] dark:text-[#E9EEF4]'
                }`}
              >
                {targetString}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {inTune ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">
                    IN TUNE
                  </span>
                ) : (
                  <span className="text-xs text-[#59677D] dark:text-[#9AA6B8] font-mono">
                    Target: {targetFreq} Hz
                  </span>
                )}
                {detectedPitch && (
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
                <span className={inTune ? 'text-emerald-600 font-bold' : ''}>
                  {centsOffset > 0 ? `+${centsOffset}` : centsOffset} cents
                </span>
                <span>Sharp (Too High)</span>
              </div>

              <div className="relative h-4 w-full bg-[#DFE5EB] dark:bg-[#223043] rounded-full overflow-hidden">
                <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-emerald-600 z-10 -translate-x-1/2" />
                <div
                  className={`absolute top-0 bottom-0 w-3 rounded-full transition-all duration-75 ${
                    inTune ? 'bg-emerald-500 shadow-sm' : centsOffset < 0 ? 'bg-blue-500' : 'bg-amber-500'
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
    </div>
  );
}
