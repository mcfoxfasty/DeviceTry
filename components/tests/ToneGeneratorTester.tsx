'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export function ToneGeneratorTester({ onResultUpdate }: ToolComponentProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [frequency, setFrequency] = useState<number>(440);
  const [waveform, setWaveform] = useState<WaveformType>('sine');
  const [volume, setVolume] = useState<number>(0.15); // conservative default gain
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const stopTone = useCallback(() => {
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, audioCtxRef.current.currentTime);
      gainRef.current.gain.linearRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + 0.05);
    }
    setTimeout(() => {
      if (oscRef.current) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch {}
        oscRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setIsPlaying(false);
    }, 60);
  }, []);

  const playTone = () => {
    stopTone();

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // smooth ramp in
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    audioCtxRef.current = ctx;
    oscRef.current = osc;
    gainRef.current = gain;
    setIsPlaying(true);

    if (onResultUpdate) {
      onResultUpdate('passed', `Generated ${frequency} Hz ${waveform} wave`);
    }
  };

  useEffect(() => {
    if (oscRef.current && audioCtxRef.current) {
      oscRef.current.frequency.setValueAtTime(frequency, audioCtxRef.current.currentTime);
    }
  }, [frequency]);

  useEffect(() => {
    if (oscRef.current) {
      oscRef.current.type = waveform;
    }
  }, [waveform]);

  useEffect(() => {
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      stopTone();
    };
  }, [stopTone]);

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
            min="20"
            max="12000"
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
              min="0.01"
              max="0.5"
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
