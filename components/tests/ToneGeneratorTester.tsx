'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

import {
  ToneSession,
  toneSessionVerdict,
  TONE_FREQUENCY_MIN,
  TONE_FREQUENCY_MAX,
  TONE_VOLUME_MIN,
  TONE_VOLUME_MAX,
} from '@/lib/testing/toneSession';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

/**
 * The tone generator drives a single ToneSession: one oscillator, one gain,
 * one context at a time. Starting replaces the current tone synchronously, so
 * overlapping tones are impossible, and every stop/unmount disconnects and
 * closes the nodes it created. On mobile Safari the start must happen inside
 * the tap handler, which is why playTone awaits the session's resume before
 * reporting anything.
 */
export function ToneGeneratorTester({ onResultUpdate }: ToolComponentProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [frequency, setFrequency] = useState<number>(440);
  const [waveform, setWaveform] = useState<WaveformType>('sine');
  const [volume, setVolume] = useState<number>(0.15); // conservative default gain
  const sessionRef = useRef<ToneSession | null>(null);

  const getSession = useCallback(() => {
    if (!sessionRef.current) sessionRef.current = new ToneSession();
    return sessionRef.current;
  }, []);

  const stopTone = useCallback(() => {
    sessionRef.current?.stop();
    setIsPlaying(false);
    onResultUpdate?.('inconclusive', 'Tone stopped. Press Play to sound a tone again.');
  }, [onResultUpdate]);

  const playTone = useCallback(async () => {
    const session = getSession();
    const outcome = await session.start({ frequency, volume, waveform });
    const verdict = toneSessionVerdict({
      started: outcome.started,
      running: outcome.running,
      contextState: outcome.contextState,
      frequency,
      waveform,
    });
    setIsPlaying(outcome.started);
    onResultUpdate?.(verdict.status, verdict.details);
  }, [frequency, volume, waveform, getSession, onResultUpdate]);

  // Live control changes while playing — the session ignores these when idle.
  useEffect(() => {
    sessionRef.current?.updateFrequency(frequency);
  }, [frequency]);

  useEffect(() => {
    sessionRef.current?.updateWaveform(waveform);
  }, [waveform]);

  useEffect(() => {
    sessionRef.current?.updateVolume(volume);
  }, [volume]);

  // Leaving the page silences the tone immediately. `dispose` also forbids
  // restarts, so no deferred finalize can resurrect audio after unmount.
  useEffect(() => {
    return () => {
      sessionRef.current?.dispose();
    };
  }, []);

  const presets = [
    { label: 'Sub Bass (60 Hz)', freq: 60 },
    { label: 'Bass (120 Hz)', freq: 120 },
    { label: 'Middle C (261.63 Hz)', freq: 261.63 },
    { label: 'Concert A4 (440 Hz)', freq: 440 },
    { label: 'Treble (1,000 Hz)', freq: 1000 },
    { label: 'High Treble (4,000 Hz)', freq: 4000 },
  ];

  return (
    <div className="space-y-6">
      <div className="p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] space-y-6">
        {/* Frequency Display */}
        <div className="text-center">
          <span className="text-xs font-semibold text-[#59677D] dark:text-[#9AA6B8] uppercase tracking-wider">
            Audio Frequency
          </span>
          <div className="font-mono text-5xl font-extrabold text-[#172033] dark:text-[#E9EEF4] mt-1">
            {frequency.toFixed(frequency % 1 === 0 ? 0 : 2)}{' '}
            <span className="text-2xl text-[#0F766E] dark:text-[#14B8A6]">Hz</span>
          </div>
        </div>

        {/* Frequency Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min={TONE_FREQUENCY_MIN}
            max={TONE_FREQUENCY_MAX}
            step="1"
            value={frequency}
            onChange={(e) => setFrequency(parseFloat(e.target.value))}
            className="w-full h-2 bg-[#DFE5EB] dark:bg-[#223043] rounded-lg appearance-none cursor-pointer accent-[#0F766E]"
          />
          <div className="flex justify-between text-[11px] font-mono text-[#59677D] dark:text-[#9AA6B8]">
            <span>20 Hz</span>
            <span>440 Hz</span>
            <span>1,000 Hz</span>
            <span>12,000 Hz</span>
          </div>
        </div>

        {/* Preset quick buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          {presets.map((p) => (
            <button
              key={p.freq}
              onClick={() => setFrequency(p.freq)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                Math.abs(frequency - p.freq) < 0.5
                  ? 'bg-[#0F766E] text-white border-[#0D665F]'
                  : 'bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Waveform Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {(['sine', 'triangle', 'square', 'sawtooth'] as WaveformType[]).map((wf) => (
            <button
              key={wf}
              onClick={() => setWaveform(wf)}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${
                waveform === wf
                  ? 'bg-[#0F766E] text-white border-[#0D665F] shadow-xs'
                  : 'bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
              }`}
            >
              {wf} Wave
            </button>
          ))}
        </div>

        {/* Volume Gain Control */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
          <Volume2 className="w-5 h-5 text-[#0F766E] shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-[#172033] dark:text-[#E9EEF4]">
              <span>Output Gain</span>
              <span className="font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={TONE_VOLUME_MIN}
              max={TONE_VOLUME_MAX}
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#DFE5EB] dark:bg-[#223043] rounded-lg appearance-none cursor-pointer accent-[#0F766E]"
            />
          </div>
        </div>

        {/* Play/Stop Trigger */}
        <div className="flex justify-center pt-2">
          {!isPlaying ? (
            <button
              onClick={playTone}
              className="px-8 py-3.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              Play Tone
            </button>
          ) : (
            <button
              onClick={stopTone}
              className="px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-sm animate-pulse"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Tone
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
