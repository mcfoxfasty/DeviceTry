'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, CheckCircle, AlertCircle, Play, Square } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import {
  createSpeakerObservation,
  markPlayed,
  confirmChannel,
  aggregateSpeakerVerdict,
  SpeakerChannel,
} from '@/lib/testing/speakerObservation';

interface SpeakersTesterProps {
  t: Translations;
  onRecordResult?: (result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive'; details: string; metrics?: Record<string, unknown> }) => void;
  onResultClear?: () => void;
  /** Registry identity for the in-card banner's safe share + history. */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
}

export function SpeakersTester({ t, onRecordResult, onResultClear, toolId, toolTitle, toolSlug }: SpeakersTesterProps) {
  const { result, emitRich, clear } = useTestResult({ onRecordResult, onResultClear });
  const [playingChannel, setPlayingChannel] = useState<'left' | 'right' | 'both' | null>(null);
  const [userObservation, setUserObservation] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const toneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Channels actually requested and played in this session — the only ones a
  // user confirmation can ever be valid for.
  const observationRef = useRef(createSpeakerObservation());
  const [hint, setHint] = useState<string | null>(null);

  const stopTone = () => {
    // Cancel any pending tone-stop timer: manual stop or a NEW tone starting
    // must never leave an old timer firing against the replacement tone.
    if (toneTimeoutRef.current !== null) {
      clearTimeout(toneTimeoutRef.current);
      toneTimeoutRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch {
        // ignore
      }
      try {
        oscillatorRef.current.disconnect();
      } catch {
        // ignore
      }
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      gainNodeRef.current = null;
    }
    if (pannerRef.current) {
      try {
        pannerRef.current.disconnect();
      } catch {
        // ignore
      }
      pannerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setPlayingChannel(null);
  };

  const playTone = (channel: 'left' | 'right' | 'both') => {
    // Stop the previous active tone AND its pending stop timer first, so the
    // old 3s timer can never kill the new tone early.
    stopTone();

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Safe low volume sine oscillator at standard 440 Hz concert pitch
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);

      // Low initial volume: 0.15
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      if (panner) {
        panner.pan.setValueAtTime(channel === 'left' ? -1 : channel === 'right' ? 1 : 0, ctx.currentTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        // Fallback for older browsers without stereo panner
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start();
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
      pannerRef.current = panner;
      setPlayingChannel(channel);
      // Only a tone that ACTUALLY started makes later confirmations valid.
      markPlayed(observationRef.current, channel);
      setHint(null);

      // Automatically stop tone after 3 seconds for comfort
      toneTimeoutRef.current = setTimeout(() => {
        toneTimeoutRef.current = null;
        stopTone();
      }, 3000);
    } catch {
      setPlayingChannel(null);
    }
  };

  const recordObservation = (obs: 'left' | 'right' | 'both' | 'none') => {
    if (obs === 'none') {
      // An explicit "heard nothing" on played channels is an observed failure
      // of those channels — never silently positive.
      const played = observationRef.current.played;
      setUserObservation('none');
      emitRich({
        status: played.length > 0 ? 'failed' : 'warning',
        details:
          played.length > 0
            ? `User reported no audible tone on the tested channel(s): ${played.join(', ')}.`
            : 'No audible-output confirmation recorded — no tone was played in this session yet.',
        metrics: { observation: 'none', channelsPlayed: played.join(',') },
      });
      return;
    }
    // A confirmation is only valid for a channel that was actually played.
    if (!confirmChannel(observationRef.current, obs as SpeakerChannel)) {
      setHint(`Play the ${obs === 'both' ? 'center/stereo' : obs} tone first, then confirm what you heard.`);
      return;
    }
    setHint(null);
    setUserObservation(obs);
    const verdict = aggregateSpeakerVerdict(observationRef.current);
    emitRich(verdict);
  };

  useEffect(() => {
    return () => {
      // Pure teardown: cancel timer, stop nodes, close context. No setState —
      // a completed guided result is preserved on unmount (departure only).
      if (toneTimeoutRef.current !== null) {
        clearTimeout(toneTimeoutRef.current);
        toneTimeoutRef.current = null;
      }
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
        } catch {
          // ignore
        }
        try {
          oscillatorRef.current.disconnect();
        } catch {
          // ignore
        }
        oscillatorRef.current = null;
      }
      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        gainNodeRef.current = null;
      }
      if (pannerRef.current) {
        try {
          pannerRef.current.disconnect();
        } catch {
          // ignore
        }
        pannerRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.speakersTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.speakersTest.shortDesc}</p>
        </div>

        {playingChannel && (
          <button
            id="btn-stop-audio-tone"
            onClick={stopTone}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            {t.speakersTest.stopTone}
          </button>
        )}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{t.speakersTest.soundLevelCaution}</span>
      </div>

      {/* Channel Play Buttons */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Channel */}
        <div className="p-5 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] text-center flex flex-col items-center justify-between">
          <span className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider">
            Left Channel (L)
          </span>
          <button
            id="btn-play-left-speaker"
            onClick={() => playTone('left')}
            className={`mt-4 w-full py-2.5 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
              playingChannel === 'left'
                ? 'bg-[#0F766E] text-white shadow-md animate-pulse'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.speakersTest.playLeft}
          </button>
        </div>

        {/* Center / Both */}
        <div className="p-5 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] text-center flex flex-col items-center justify-between">
          <span className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider">
            Center (L + R)
          </span>
          <button
            id="btn-play-both-speakers"
            onClick={() => playTone('both')}
            className={`mt-4 w-full py-2.5 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
              playingChannel === 'both'
                ? 'bg-[#0F766E] text-white shadow-md animate-pulse'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.speakersTest.playBoth}
          </button>
        </div>

        {/* Right Channel */}
        <div className="p-5 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] text-center flex flex-col items-center justify-between">
          <span className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider">
            Right Channel (R)
          </span>
          <button
            id="btn-play-right-speaker"
            onClick={() => playTone('right')}
            className={`mt-4 w-full py-2.5 px-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
              playingChannel === 'right'
                ? 'bg-[#0F766E] text-white shadow-md animate-pulse'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.speakersTest.playRight}
          </button>
        </div>
      </div>

      {/* User Confirmation Observation Section */}
      <div className="mt-6 p-4 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
        <p className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4] mb-3">
          {t.speakersTest.confirmPrompt}
        </p>

        {hint && (
          <p className="mb-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">{hint}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => recordObservation('left')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              userObservation === 'left'
                ? 'bg-[#0F766E] text-white border-[#0D665F]'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            {t.speakersTest.heardLeft}
          </button>
          <button
            onClick={() => recordObservation('right')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              userObservation === 'right'
                ? 'bg-[#0F766E] text-white border-[#0D665F]'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            {t.speakersTest.heardRight}
          </button>
          <button
            onClick={() => recordObservation('both')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              userObservation === 'both'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
            {t.speakersTest.heardBoth}
          </button>
          <button
            onClick={() => recordObservation('none')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              userObservation === 'none'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
            }`}
          >
            <VolumeX className="w-3.5 h-3.5 inline mr-1" />
            {t.speakersTest.heardNothing}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[#8996A6] mt-3 italic">
        {t.speakersTest.physicalDisclaimer}
      </p>

      {/* Test result — in-card, directly under the test area */}
      <TestResultBanner result={result} onClear={clear} toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />

      {/* Evaluation guidance */}
      <div className="mt-6 pt-5 border-t border-[#DFE5EB] dark:border-[#223043] text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
          {t.speakersTest.interpretationTitle}
        </h3>
        <p className="leading-relaxed">{t.speakersTest.interpretationText}</p>
      </div>
    </div>
  );
}
