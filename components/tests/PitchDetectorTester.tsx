'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function autoCorrelate(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.015) {
    return { freq: -1, confidence: 0 }; // Not enough signal volume
  }

  let r1 = 0;
  let r2 = buffer.length - 1;
  const threshold = 0.2;
  for (let i = 0; i < buffer.length / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < buffer.length / 2; i++) {
    if (Math.abs(buffer[buffer.length - i]) < threshold) {
      r2 = buffer.length - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
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

  let T0 = maxpos;
  // Parabolic interpolation around peak
  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) {
    T0 = T0 - b / (2 * a);
  }

  const freq = sampleRate / T0;
  const confidence = maxval / c[0];
  return { freq, confidence };
}

function noteFromPitch(frequency: number) {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency: number, note: number) {
  return Math.floor((1200 * Math.log(frequency / frequencyFromNoteNumber(note))) / Math.log(2));
}

export function PitchDetectorTester({ onResultUpdate }: ToolComponentProps) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [pitch, setPitch] = useState<number | null>(null);
  const [noteName, setNoteName] = useState<string>('--');
  const [octave, setOctave] = useState<number | null>(null);
  const [cents, setCents] = useState<number>(0);
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

  const updatePitch = useCallback(() => {
    if (!analyserRef.current || !audioCtxRef.current) return;
    const buf = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buf);

    const { freq, confidence } = autoCorrelate(buf, audioCtxRef.current.sampleRate);
    if (freq > 40 && freq < 2500 && confidence > 0.85) {
      setPitch(Math.round(freq * 10) / 10);
      const note = noteFromPitch(freq);
      const name = NOTE_NAMES[note % 12];
      const oct = Math.floor(note / 12) - 1;
      const off = centsOffFromPitch(freq, note);
      setNoteName(name);
      setOctave(oct);
      setCents(off);
    }
    rafRef.current = requestAnimationFrame(updatePitch);
  }, []);

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

      rafRef.current = requestAnimationFrame(updatePitch);

      if (onResultUpdate) {
        onResultUpdate('passed', 'Pitch detector engine running');
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
            {/* Note Display */}
            <div className="flex flex-col items-center">
              <div className="flex items-baseline justify-center gap-1 font-extrabold text-[#172033] dark:text-[#E9EEF4]">
                <span className="text-7xl tracking-tighter">{noteName}</span>
                {octave !== null && <span className="text-3xl text-[#0F766E]">{octave}</span>}
              </div>
              <div className="font-mono text-sm text-[#59677D] dark:text-[#9AA6B8] mt-1">
                {pitch ? `${pitch.toFixed(1)} Hz` : 'Listening for audio signal...'}
              </div>
            </div>

            {/* Cents meter bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono font-semibold text-[#59677D] dark:text-[#9AA6B8]">
                <span>-50 Flat</span>
                <span className={Math.abs(cents) <= 5 ? 'text-emerald-600 font-bold' : ''}>
                  {cents > 0 ? `+${cents}` : cents} cents
                </span>
                <span>+50 Sharp</span>
              </div>
              <div className="relative h-3 w-full bg-[#DFE5EB] dark:bg-[#223043] rounded-full overflow-hidden">
                {/* Center target tick */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400 dark:bg-slate-500 z-10" />
                {/* Indicator needle */}
                <div
                  className={`absolute top-0 bottom-0 w-2 rounded-full transition-all duration-75 ${
                    Math.abs(cents) <= 5
                      ? 'bg-emerald-500 shadow-xs'
                      : cents < 0
                      ? 'bg-blue-500'
                      : 'bg-amber-500'
                  }`}
                  style={{
                    left: `${Math.max(5, Math.min(95, 50 + cents))}%`,
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
              Stop Listening
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
