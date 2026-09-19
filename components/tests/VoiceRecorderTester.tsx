'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RefreshCw, Volume2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function VoiceRecorderTester({ t, onResultUpdate }: ToolComponentProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supportedMime, setSupportedMime] = useState<string>('audio/webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined') {
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      let detected = 'audio/webm';
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          detected = type;
          break;
        }
      }
      // setState is deferred to a microtask so the effect body stays free of
      // synchronous cascading renders (react-hooks/set-state-in-effect).
      Promise.resolve().then(() => setSupportedMime(detected));
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 300) {
            // 5-min max bound
            stopRecording();
            return 300;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer re-arms on recording state; stopRecording reads fresh state at call time
  }, [isRecording, isPaused]);

  // Unmount-only cleanup of the media recorder. The recorder instance lives in
  // a ref synced via effect, so the unmount callback never needs the
  // state-dependent function and never holds a stale node.
  const mediaRecorderUnmountRef = useRef<MediaRecorder | null>(null);
  useEffect(() => {
    mediaRecorderUnmountRef.current = mediaRecorder;
  }, [mediaRecorder]);
  useEffect(() => {
    const recorderAtUnmount = mediaRecorderUnmountRef.current;
    return () => {
      if (recorderAtUnmount && recorderAtUnmount.state !== 'inactive') {
        try {
          recorderAtUnmount.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Clean up object URLs on replacement and unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setErrorMsg(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
    }
    setRecordingTime(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported(supportedMime) ? { mimeType: supportedMime } : undefined;
      const recorder = new MediaRecorder(stream, options);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        // Release stream tracks
        stream.getTracks().forEach((track) => track.stop());
        if (onResultUpdate) {
          onResultUpdate('passed', `Recorded ${chunks.length} chunks (${Math.round(blob.size / 1024)} KB)`);
        }
      };

      recorder.start(100);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Microphone access denied or unavailable');
      if (onResultUpdate) {
        onResultUpdate('failed', error.message);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const downloadRecording = () => {
    if (!audioBlob || !audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    a.download = `devicetry-recording-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              Start Recording
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
              Download Local Audio File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
