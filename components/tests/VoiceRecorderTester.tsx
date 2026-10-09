'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, RefreshCw, AlertCircle, CheckCircle2, Download, MicOff, Pause } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { RecordingSession, MediaStreamLike } from '@/lib/testing/recordingSession';
import { WAV_MIME_TYPE, createWavBlob } from '@/lib/testing/wavEncoder';
import {
  PCM_MAX_RECORDING_SECONDS,
  PcmAccumulator,
  describeError,
  detectPcmCaptureSupport,
  type PcmCaptureSupport,
} from '@/lib/testing/pcmRecorder';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

/** Hard duration cap of the current implementation (seconds). */
const MAX_RECORDING_SECONDS = PCM_MAX_RECORDING_SECONDS; // 5 minutes

/**
 * Frames per audio callback. 4096 is the value Safari and Chromium both
 * tolerate best; it keeps the per-callback copy small while staying far from
 * any risk of dropping buffers.
 */
const PCM_BUFFER_FRAMES = 4096;

type AudioContextCtor = new () => AudioContext;

/**
 * Resolve the Web Audio constructor, including Safari's legacy
 * `webkitAudioContext` spelling. Returns null when the browser has no Web Audio
 * at all, which the probe reports honestly rather than crashing.
 */
function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  const ctor = scope.AudioContext ?? scope.webkitAudioContext;
  return typeof ctor === 'function' ? (ctor as AudioContextCtor) : null;
}

function stopStreamTracks(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // individual track stop failures are non-fatal
    }
  });
}

export function VoiceRecorderTester({ onResultUpdate }: ToolComponentProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** null until the capability probe finishes. */
  const [captureSupport, setCaptureSupport] = useState<PcmCaptureSupport | null>(null);
  /** Real, factual readout for on-device diagnosis — never a guess. */
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  /** Seconds actually captured, shown after a run so truncation is visible. */
  const [capturedSeconds, setCapturedSeconds] = useState<number | null>(null);

  // Durable references for deterministic cleanup.
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sinkNodeRef = useRef<GainNode | null>(null);
  const accumulatorRef = useRef<PcmAccumulator | null>(null);
  /** Pause gate: samples keep arriving while paused, they are simply ignored. */
  const capturingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  // Set on unmount only: in-flight getUserMedia must never touch state after it.
  const unmountedRef = useRef(false);
  // The request in flight, so a late resolution can be recognized and dropped.
  const sessionRef = useRef<RecordingSession>(new RecordingSession());
  const runTokenRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Tear the Web Audio graph down: detach the callback first so no late audio
   * callback can append after teardown, then disconnect every node and close
   * the context. The accumulator is deliberately left alone — the Stop path
   * still needs its samples.
   */
  const teardownCaptureGraph = useCallback(() => {
    capturingRef.current = false;

    const processor = processorNodeRef.current;
    if (processor) {
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
      } catch {
        // already disconnected
      }
      processorNodeRef.current = null;
    }

    const source = sourceNodeRef.current;
    if (source) {
      try {
        source.disconnect();
      } catch {
        // already disconnected
      }
      sourceNodeRef.current = null;
    }

    const sink = sinkNodeRef.current;
    if (sink) {
      try {
        sink.disconnect();
      } catch {
        // already disconnected
      }
      sinkNodeRef.current = null;
    }

    const context = audioContextRef.current;
    if (context) {
      try {
        void context.close();
      } catch {
        // context already closed
      }
      audioContextRef.current = null;
    }
  }, []);

  /** Full teardown for cancel/unmount/error: also drops captured samples. */
  const releaseResources = useCallback(() => {
    clearTimer();
    teardownCaptureGraph();
    const stream = streamRef.current;
    stopStreamTracks(stream);
    streamRef.current = null;
    accumulatorRef.current = null;
  }, [clearTimer, teardownCaptureGraph]);

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      setAudioUrl(null);
      setAudioBlob(null);
    }
  }, []);

  const cancelActiveRecording = useCallback(() => {
    sessionRef.current.cancel();
    releaseResources();
    setIsRecording(false);
    setIsPaused(false);
  }, [releaseResources]);

  /**
   * Encode the captured PCM as a genuine WAVE file and publish it.
   *
   * There is no fallback path: if the samples cannot be encoded, or none were
   * captured, the attempt is reported as a failure and no player is shown. The
   * broken-format clip is never presented as a success.
   */
  const finalizeRecording = useCallback(
    (token: number) => {
      const accumulator = accumulatorRef.current;
      accumulatorRef.current = null;

      const frameCount = accumulator?.frameCount ?? 0;
      const finished = sessionRef.current.finishRecording(token, frameCount);

      if (unmountedRef.current || token !== runTokenRef.current) {
        return;
      }
      if (!finished) {
        setErrorMsg(
          'No audio data was captured. Check that the selected microphone is not muted, then try again.',
        );
        onResultUpdate?.('inconclusive', 'No audio data captured — the PCM tap produced no samples.');
        return;
      }

      let wav: ArrayBuffer | null = null;
      try {
        wav = accumulator!.toWav();
      } catch (err: unknown) {
        const detail = describeError(err);
        setErrorMsg(`Could not encode the recording as WAV — ${detail}`);
        onResultUpdate?.('failed', `WAV encoding failed — ${detail}`);
        return;
      }

      if (!wav) {
        setErrorMsg('The recording produced no samples to encode.');
        onResultUpdate?.('inconclusive', 'WAV encoding produced no samples.');
        return;
      }

      const blob = createWavBlob(wav);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioBlob(blob);
      setAudioUrl(url);

      const seconds = accumulator!.durationSeconds;
      const dropped = accumulator!.droppedFrames;
      const sampleRate = accumulator!.sampleRateHz;
      setCapturedSeconds(seconds);

      const sizeKb = Math.round(blob.size / 1024);
      const durationLabel = `${seconds.toFixed(1)}s`;
      if (dropped > 0) {
        // Overflow past the cap is reported, never silently swallowed.
        onResultUpdate?.(
          'warning',
          `Recording saved as a genuine WAV (${durationLabel}, ${sizeKb} KB). ${(dropped / sampleRate).toFixed(1)}s beyond the 5-minute limit was not captured.`,
        );
      } else {
        onResultUpdate?.(
          'passed',
          `Recording captured as ${WAV_MIME_TYPE} (${durationLabel}, ${sizeKb} KB, ${sampleRate} Hz mono PCM).`,
        );
      }
    },
    [onResultUpdate],
  );

  /**
   * Stop capture and publish the recording.
   *
   * The graph is torn down first so nothing can append while the WAVE file is
   * being written, but the samples are kept. Since PCM was captured live there
   * is no container to decode here — this cannot fail the way decoding Safari's
   * MP4 did.
   */
  const stopRecording = useCallback(() => {
    clearTimer();
    teardownCaptureGraph();
    stopStreamTracks(streamRef.current);
    streamRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    finalizeRecording(runTokenRef.current);
  }, [clearTimer, finalizeRecording, teardownCaptureGraph]);

  // Probe Web Audio PCM capability honestly (deferred set, no effect-body setState).
  useEffect(() => {
    let cancelled = false;
    const probe = () => {
      if (cancelled) return;
      const scope = typeof window === 'undefined' ? null : window;
      const support = detectPcmCaptureSupport(scope);
      setCaptureSupport(support);
      const ctor = resolveAudioContextCtor();
      setDiagnostics([
        `AudioContext: ${support.hasAudioContext ? 'available' : 'missing'}`,
        `createMediaStreamSource(): ${support.hasMediaStreamSource ? 'available' : 'missing'}`,
        `createScriptProcessor(): ${support.hasScriptProcessor ? 'available' : 'missing'}`,
        `Capture method: live PCM tap (no MP4 decode)${ctor ? '' : ' — unavailable'}`,
      ]);
    };
    const raf = requestAnimationFrame(probe);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Duration timer: respects pause and the 5-minute cap via explicit stop.
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording, isPaused, stopRecording]);

  // Unmount: invalidate pending work and release everything. A completed
  // recording (and its guided/host result) is NOT cleared — only resources.
  useEffect(() => {
    // Cleared by the effect BODY, not only raised by the cleanup: development
    // StrictMode remounts effects without re-initialising refs, and a stale
    // `true` makes every getUserMedia result look superseded — the recorder
    // would silently refuse to start.
    unmountedRef.current = false;
    const session = sessionRef.current;
    return () => {
      unmountedRef.current = true;
      capturingRef.current = false;
      session.cancel();
      releaseResources();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [releaseResources]);

  const startRecording = async () => {
    if (!captureSupport) return;
    if (!captureSupport.supported) {
      setErrorMsg(captureSupport.detail);
      onResultUpdate?.('unsupported', captureSupport.detail);
      return;
    }

    const token = ++runTokenRef.current;
    if (!sessionRef.current.begin(token)) {
      return;
    }

    setErrorMsg(null);
    setIsRequesting(true);
    setCapturedSeconds(null);
    clearAudioUrl();
    setRecordingTime(0);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const adopted = sessionRef.current.adoptStream(token, mediaStream as unknown as MediaStreamLike);
      if (unmountedRef.current || adopted === null) {
        // Superseded by cancel/replace/unmount: adoptStream already stopped
        // every returned track; update nothing.
        setIsRequesting(false);
        return;
      }
      streamRef.current = mediaStream;

      const Ctor = resolveAudioContextCtor();
      if (!Ctor) {
        throw new Error(
          'Web Audio became unavailable: window.AudioContext and window.webkitAudioContext are both missing.',
        );
      }

      const context = new Ctor();
      // A context created outside a user gesture starts suspended on iOS; the
      // graph is silent so resuming it cannot produce audible output.
      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch {
          // resume is best-effort; the tap below either works or reports why
        }
      }

      const accumulator = new PcmAccumulator(context.sampleRate, MAX_RECORDING_SECONDS);
      const source = context.createMediaStreamSource(mediaStream);
      const processor = context.createScriptProcessor(PCM_BUFFER_FRAMES, 1, 1);
      const sink = context.createGain();
      // The processor only runs while connected to the destination, but routing
      // the microphone there would be audible feedback. A zero-gain sink keeps
      // the graph pulled and completely silent.
      sink.gain.value = 0;

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!capturingRef.current) return;
        accumulator.append(event.inputBuffer.getChannelData(0));
      };

      audioContextRef.current = context;
      accumulatorRef.current = accumulator;
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      sinkNodeRef.current = sink;

      source.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination);

      capturingRef.current = true;

      setDiagnostics((prev) => {
        const withoutRate = prev.filter((line) => !line.startsWith('Sample rate:'));
        return [...withoutRate, `Sample rate: ${context.sampleRate} Hz`];
      });
      setIsRequesting(false);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err: unknown) {
      const detail = describeError(err);
      setIsRequesting(false);
      // Cancel the attempt so a late resolution cannot adopt.
      sessionRef.current.cancel();
      releaseResources();
      if (unmountedRef.current || token !== runTokenRef.current) {
        return;
      }
      setErrorMsg(`Could not start recording — ${detail}`);
      onResultUpdate?.('failed', `Could not start recording — ${detail}`);
    }
  };

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;
    capturingRef.current = false;
    setIsPaused(true);
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;
    capturingRef.current = true;
    setIsPaused(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /** The recording is always a genuine WAVE file, so the extension always is. */
  const recordingExtension = 'wav';

  const downloadRecording = () => {
    if (!audioBlob || !audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `devicetry-recording-${Date.now()}.${recordingExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (captureSupport && !captureSupport.supported) {
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col items-center justify-center text-center space-y-4">
          <MicOff className="w-10 h-10 text-[#8996A6]" />
          <h3 className="text-lg font-bold text-[#172033] dark:text-[#E9EEF4]">Recording unavailable</h3>
          <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] max-w-md">{captureSupport.detail}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main recording studio container */}
      <div className="p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col items-center justify-center text-center space-y-6">
        {/* Timer readout */}
        <div className="flex flex-col items-center">
          <div className="font-mono text-5xl font-extrabold tracking-tight text-[#172033] dark:text-[#E9EEF4]">
            {formatTime(recordingTime)}
          </div>
          <span className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-1">
            Max limit: 05:00 • In-memory capture
          </span>
        </div>

        {/* Live pulsing indicator when recording */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-xs font-semibold animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            {isPaused ? 'Recording Paused' : 'Recording in Progress...'}
          </div>
        )}

        {/* Actions button bar */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isRequesting || !captureSupport}
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              {isRequesting ? 'Requesting…' : 'Start Recording'}
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={resumeRecording}
                  className="px-5 py-2.5 bg-[#0F766E] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-white" />
                  Pause
                </button>
              )}
              <button
                onClick={stopRecording}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                Stop
              </button>
            </>
          )}

          {audioUrl && !isRecording && (
            <button
              onClick={startRecording}
              disabled={isRequesting || !captureSupport}
              className="px-4 py-2.5 bg-[#F6F8FB] dark:bg-[#192332] text-[#172033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-xl text-xs font-semibold hover:border-[#0F766E] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Record Again
            </button>
          )}
        </div>

        {/* Playback preview player */}
        {audioUrl && !isRecording && (
          <div className="w-full max-w-md p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#172033] dark:text-[#E9EEF4]">
              <span className="flex items-center gap-1.5 text-[#0F766E] dark:text-[#14B8A6]">
                <CheckCircle2 className="w-4 h-4" />
                Recording Ready — WAV
              </span>
              <span>{Math.round((audioBlob?.size || 0) / 1024)} KB</span>
            </div>

            <audio src={audioUrl} controls preload="metadata" playsInline className="w-full h-10" />

            {capturedSeconds !== null && (
              <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8]">
                {capturedSeconds.toFixed(1)}s captured • genuine WAV ({(audioBlob?.type || WAV_MIME_TYPE)})
              </p>
            )}

            <button
              onClick={downloadRecording}
              className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Local Audio File (.{recordingExtension})
            </button>
          </div>
        )}
      </div>

      {/* On-device diagnostics: the real API facts, so a failing device can be
          diagnosed from the screen instead of guessed at. */}
      {diagnostics.length > 0 && (
        <details className="rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] p-3">
          <summary className="text-[11px] font-bold text-[#59677D] dark:text-[#9AA6B8] cursor-pointer">
            Capture diagnostics
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-[#59677D] dark:text-[#9AA6B8]">
            {diagnostics.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
