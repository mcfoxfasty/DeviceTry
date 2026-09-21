'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, RefreshCw, AlertCircle, CheckCircle2, Download, MicOff } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import {
  isMediaRecorderAvailable,
  selectRecordingMimeType,
  actualBlobMimeType,
  extensionForMimeType,
  FALLBACK_MIME,
} from '@/lib/testing/recordingFormat';
import { RecordingSession, MediaStreamLike } from '@/lib/testing/recordingSession';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

/** Hard duration cap of the current implementation (seconds). */
const MAX_RECORDING_SECONDS = 300; // 5 minutes

export function VoiceRecorderTester({ t, onResultUpdate }: ToolComponentProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [recorderUnsupported, setRecorderUnsupported] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // null until probing completes; '' means no supported MIME (honest unsupported).
  const [supportedMime, setSupportedMime] = useState<string | null>(null);

  // Durable references for deterministic cleanup (requirement 1).
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  // Set on unmount only: in-flight getUserMedia must never touch state after it.
  const unmountedRef = useRef(false);
  // The request in flight, so a late resolution can be recognized and dropped.
  const sessionRef = useRef<RecordingSession>(new RecordingSession());
  const runTokenRef = useRef(0);

  /** Pure teardown: stop recorder + every track, clear timer, detach callbacks. */
  const releaseResources = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      // Detach callbacks first so a late onstop/ondataavailable cannot
      // create blobs, object URLs, or result updates after teardown.
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onpause = null;
      recorder.onresume = null;
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch {
        // already inactive — ignore
      }
      mediaRecorderRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      setAudioUrl(null);
      setAudioBlob(null);
    }
  }, []);

  /** Explicit cancel/replace: invalidate the attempt first, then teardown. */
  const cancelActiveRecording = useCallback(() => {
    sessionRef.current.cancel();
    releaseResources();
    setIsRecording(false);
    setIsPaused(false);
  }, [releaseResources]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // onstop (guarded by token + chunks) finalizes the blob and verdict.
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // Probe MediaRecorder support honestly (deferred set, no effect-body setState).
  useEffect(() => {
    let cancelled = false;
    const probe = () => {
      if (cancelled) return;
      if (!isMediaRecorderAvailable(MediaRecorder)) {
        setRecorderUnsupported(true);
        setSupportedMime('');
        return;
      }
      const selected = selectRecordingMimeType(MediaRecorder);
      setSupportedMime(selected ?? '');
      if (!selected) {
        setRecorderUnsupported(true);
      }
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
    // Capture refs up front — cleanup must not read them after unmount.
    const session = sessionRef.current;
    return () => {
      unmountedRef.current = true;
      session.releaseResources({
        stream: streamRef.current,
        recorder: mediaRecorderRef.current,
      });
      mediaRecorderRef.current = null;
      streamRef.current = null;
      releaseResources();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup for refs and stable functions
  }, []);

  const startRecording = async () => {
    if (recorderUnsupported || supportedMime === '') {
      setErrorMsg('Audio recording is not supported by this browser.');
      return;
    }
    // Prevent concurrent starts / repeated recorder instances.
    const token = ++runTokenRef.current;
    if (!sessionRef.current.begin(token)) {
      return;
    }

    setErrorMsg(null);
    setIsRequesting(true);
    // Revoke the previous clip only when it is being replaced (never while
    // it is the active playback/download URL without replacement).
    clearAudioUrl();
    setRecordingTime(0);
    chunksRef.current = [];

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

      const mimeType = supportedMime && supportedMime !== '' && MediaRecorder.isTypeSupported(supportedMime)
        ? supportedMime
        : undefined;
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      if (!sessionRef.current.attachRecorder(token, recorder)) {
        // Stale in the gap between adoption and recorder creation.
        releaseResources();
        setIsRequesting(false);
        return;
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (unmountedRef.current || token !== runTokenRef.current) {
          return; // late stop from a superseded attempt: report nothing
        }
        finalizeRecording();
      };

      recorder.start(1000);
      setIsRequesting(false);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err: unknown) {
      const error = err as Error;
      setIsRequesting(false);
      // Cancel the attempt so a late resolution (should not happen after a
      // rejection, but be safe) cannot adopt.
      sessionRef.current.cancel();
      releaseResources();
      if (unmountedRef.current || token !== runTokenRef.current) {
        return;
      }
      setErrorMsg(error.message || 'Microphone access denied or unavailable');
      onResultUpdate?.('failed', error.message || 'Microphone access denied or unavailable');
    }
  };

  const finalizeRecording = () => {
    // Capture the ACTUAL recorder MIME before releaseResources() nulls the ref.
    const recorderMime = mediaRecorderRef.current?.mimeType ?? null;
    // A success verdict requires ACTUAL recorded data (requirement 2).
    const finished = sessionRef.current.finishRecording(runTokenRef.current, chunksRef.current.length);
    releaseResources();
    if (!finished) {
      setErrorMsg('No audio data was captured. Please check the selected microphone and try again.');
      onResultUpdate?.('inconclusive', 'No audio data captured — recording produced no usable chunks.');
      return;
    }
    const blobType = actualBlobMimeType(recorderMime, supportedMime ?? FALLBACK_MIME);
    const blob = new Blob(chunksRef.current, { type: blobType });
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioBlob(blob);
    setAudioUrl(url);
    onResultUpdate?.('passed', `Recording captured locally (${chunksRef.current.length} audio chunk${chunksRef.current.length === 1 ? '' : 's'}, ${Math.round(blob.size / 1024)} KB).`);
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.pause();
        setIsPaused(true);
      } catch {
        // ignore
      }
    }
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      try {
        recorder.resume();
        setIsPaused(false);
      } catch {
        // ignore
      }
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /** Accurate extension from the ACTUAL blob MIME (fixes the Ogg mismatch). */
  const recordingExtension = extensionForMimeType(audioBlob?.type) ?? 'webm';

  const downloadRecording = () => {
    if (!audioBlob || !audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `devicetry-recording-${Date.now()}.${recordingExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (recorderUnsupported || supportedMime === '') {
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] flex flex-col items-center justify-center text-center space-y-4">
          <MicOff className="w-10 h-10 text-[#8996A6]" />
          <h3 className="text-lg font-bold text-[#172033] dark:text-[#E9EEF4]">Recording unavailable</h3>
          <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] max-w-md">
            This browser does not expose the MediaRecorder audio recording API (or no supported audio
            container). No recording can be captured here — try a current version of Chrome, Edge,
            Firefox, or Safari instead.
          </p>
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
            {isPaused ? 'Recording Paused' : isRequesting ? 'Requesting microphone…' : 'Recording in Progress...'}
          </div>
        )}

        {/* Actions button bar */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isRequesting}
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
              disabled={isRequesting}
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
                Recording Ready
              </span>
              <span>{Math.round((audioBlob?.size || 0) / 1024)} KB</span>
            </div>

            <audio src={audioUrl} controls className="w-full h-10" />

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
    </div>
  );
}
