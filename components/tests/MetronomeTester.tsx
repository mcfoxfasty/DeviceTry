'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Plus, Minus, Timer } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function MetronomeTester({ onResultUpdate }: ToolComponentProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(120);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState<number>(4);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.2);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerWorkerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentBeatRef = useRef<number>(0);
  const tapTimesRef = useRef<number[]>([]);
  // UI beat-indicator timers: every scheduled setTimeout is tracked here and
  // ALL are cleared on stop/unmount — previously they fired after stop,
  // updating state for a metronome that was no longer running.
  const uiTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Live tempo mirrors: the running scheduler reads these refs so tempo and
  // time-signature changes take effect immediately during playback — no
  // restart needed, no stale interval closure.
  const bpmRef = useRef<number>(120);
  const beatsRef = useRef<number>(4);
  const volumeRef = useRef<number>(0.2);

  const clearUiTimeouts = useCallback(() => {
    for (const id of uiTimeoutsRef.current) {
      clearTimeout(id);
    }
    uiTimeoutsRef.current = [];
  }, []);

  const scheduleUiBeat = useCallback((beat: number, delayMs: number) => {
    const id = setTimeout(() => {
      setCurrentBeat(beat);
      // Remove this id once fired to keep the array bounded.
      uiTimeoutsRef.current = uiTimeoutsRef.current.filter((t) => t !== id);
    }, Math.max(0, delayMs));
    uiTimeoutsRef.current.push(id);
  }, []);

  const scheduleNote = useCallback((beatNumber: number, time: number) => {
    if (!audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();

    // High woodblock tick on beat 0 (accent), lower on regular beats
    const isAccent = beatNumber === 0;
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);

    gain.gain.setValueAtTime(volumeRef.current, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  // Web Audio lookahead scheduler. Reads bpm/beats from refs: changes apply
  // to the NEXT scheduled beat while playing (immediate, no loop stacking —
  // there is exactly one interval per session).
  const scheduler = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      scheduleNote(currentBeatRef.current, nextNoteTimeRef.current);
      scheduleUiBeat(
        currentBeatRef.current,
        (nextNoteTimeRef.current - ctx.currentTime) * 1000
      );

      const secondsPerBeat = 60.0 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat;
      currentBeatRef.current = (currentBeatRef.current + 1) % beatsRef.current;
    }
  }, [scheduleNote, scheduleUiBeat]);

  const stopMetronome = useCallback(() => {
    if (timerWorkerRef.current !== null) {
      clearInterval(timerWorkerRef.current);
      timerWorkerRef.current = null;
    }
    clearUiTimeouts();
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
  }, [clearUiTimeouts]);

  const startMetronome = () => {
    stopMetronome();

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    bpmRef.current = bpm;
    beatsRef.current = beatsPerMeasure;
    volumeRef.current = volume;
    currentBeatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;

    // Exactly ONE scheduler interval per session.
    timerWorkerRef.current = setInterval(scheduler, 25);
    setIsPlaying(true);

    onResultUpdate?.('inconclusive', `Metronome playing at ${bpm} BPM (${beatsPerMeasure}/4) — audible confirmation requires the user to hear the ticks`);
  };

  // Keep the live refs in sync so mid-playback changes apply immediately.
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsRef.current = beatsPerMeasure;
  }, [beatsPerMeasure]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    return () => {
      // Navigation/departure: stop everything — interval, every pending UI
      // beat timer, and the AudioContext.
      stopMetronome();
    };
  }, [stopMetronome]);

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    taps.push(now);
    if (taps.length > 4) taps.shift();

    if (taps.length >= 2) {
      let sumInterval = 0;
      for (let i = 1; i < taps.length; i++) {
        sumInterval += taps[i] - taps[i - 1];
      }
      const avgInterval = sumInterval / (taps.length - 1);
      const detectedBpm = Math.round(60000 / avgInterval);
      if (detectedBpm >= 30 && detectedBpm <= 280) {
        setBpm(detectedBpm);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col items-center justify-center text-center space-y-6">
        {/* BPM Counter */}
        <div className="flex flex-col items-center">
          <span className="text-xs font-semibold text-[#59677D] dark:text-[#9AA6B8] uppercase tracking-wider">
            Tempo (BPM)
          </span>
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => setBpm((b) => Math.max(30, b - 1))}
              className="w-10 h-10 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center justify-center text-[#172033] dark:text-[#E9EEF4] hover:border-[#0F766E] cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="font-mono text-6xl font-black text-[#172033] dark:text-[#E9EEF4] w-36 text-center">
              {bpm}
            </div>

            <button
              onClick={() => setBpm((b) => Math.min(280, b + 1))}
              className="w-10 h-10 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center justify-center text-[#172033] dark:text-[#E9EEF4] hover:border-[#0F766E] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BPM Slider */}
        <div className="w-full max-w-md space-y-2">
          <input
            type="range"
            min="30"
            max="280"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-full h-2 bg-[#DFE5EB] dark:bg-[#223043] rounded-lg appearance-none cursor-pointer accent-[#0F766E]"
          />
          <div className="flex justify-between text-[11px] font-mono text-[#59677D] dark:text-[#9AA6B8]">
            <span>Largo (40)</span>
            <span>Andante (80)</span>
            <span>Allegro (120)</span>
            <span>Presto (180)</span>
          </div>
        </div>

        {/* Visual Beat Indicator Dots */}
        <div className="flex items-center gap-3">
          {Array.from({ length: beatsPerMeasure }).map((_, idx) => (
            <div
              key={idx}
              className={`w-6 h-6 rounded-full transition-all duration-75 flex items-center justify-center font-mono text-xs font-bold ${
                isPlaying && currentBeat === idx
                  ? idx === 0
                    ? 'bg-amber-500 text-white scale-125 shadow-md'
                    : 'bg-[#0F766E] text-white scale-110 shadow-sm'
                  : 'bg-[#DFE5EB] dark:bg-[#223043] text-[#59677D] dark:text-[#9AA6B8]'
              }`}
            >
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <span className="text-xs font-semibold text-[#59677D] dark:text-[#9AA6B8]">Volume</span>
          <input
            type="range"
            min="0"
            max="60"
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
            className="w-full h-2 bg-[#DFE5EB] dark:bg-[#223043] rounded-lg appearance-none cursor-pointer accent-[#0F766E]"
          />
        </div>

        {/* Controls: Time Signature & Tap Tempo */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-1 bg-[#F6F8FB] dark:bg-[#192332] p-1 rounded-xl border border-[#DFE5EB] dark:border-[#223043]">
            {[2, 3, 4, 6].map((num) => (
              <button
                key={num}
                onClick={() => setBeatsPerMeasure(num)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  beatsPerMeasure === num
                    ? 'bg-[#0F766E] text-white shadow-xs'
                    : 'text-[#59677D] dark:text-[#9AA6B8]'
                }`}
              >
                {num}/4
              </button>
            ))}
          </div>

          <button
            onClick={handleTapTempo}
            className="px-4 py-2 bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-xl text-xs font-bold hover:border-[#0F766E] cursor-pointer"
          >
            Tap Tempo
          </button>
        </div>

        {/* Start / Stop Toggle */}
        <div className="pt-2">
          {!isPlaying ? (
            <button
              onClick={startMetronome}
              className="px-8 py-3.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              Start Metronome
            </button>
          ) : (
            <button
              onClick={stopMetronome}
              className="px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Metronome
            </button>
          )}
        </div>
      </div>

      {/* Honest timing disclosure */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] space-y-1">
        <p className="flex items-start gap-1.5">
          <Timer className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Timing accuracy:</strong> audio ticks are scheduled on the Web Audio clock with a 100 ms
            look-ahead, which keeps the beat steady while the tab is focused. Browsers throttle timers in
            background tabs, so the visual beat dots (and any newly scheduled audio) can lag when this page is
            not visible. Supported tempo range: 30–280 BPM — the full slider range is genuinely schedulable
            by the look-ahead loop.
          </span>
        </p>
      </div>
    </div>
  );
}
