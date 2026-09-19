'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Square, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { PermissionDeniedModal } from '@/components/PermissionDeniedModal';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';

interface MicrophoneTesterProps {
  t: Translations;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
}

export function MicrophoneTester({ t, onRecordResult }: MicrophoneTesterProps) {
  const { result, emitRunRich, clear, reset, startRun } = useTestResult({ onRecordResult });
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDeniedModal, setShowDeniedModal] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [peakLevel, setPeakLevel] = useState<number>(0);

  // Recording sample state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordTimeLeft, setRecordTimeLeft] = useState<number>(5);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Stable references for deterministic cleanup without stale closures
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedAudioUrlRef = useRef<string | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Run token: emissions from getUserMedia resolutions, timers, or rAF loops
  // captured before a stop/device-change/reset are ignored.
  const runTokenRef = useRef<number>(0);

  // Load audio input devices list
  const loadDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
      setDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch {
      // ignore
    }
  };

  const stopMicrophone = () => {
    // Invalidate the current run first so any in-flight getUserMedia
    // resolution, recorder stop, or rAF callback cannot restore an old verdict.
    reset();
    runTokenRef.current = startRun();

    // 1. Cancel animation frame loop
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 2. Stop countdown timer if recording
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // 3. Stop MediaRecorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    // 4. Stop and release all tracks on streamRef
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    // 5. Close Web Audio Context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setInputLevel(0);
    setPermissionState('idle');
    setIsRecording(false);
  };

  const startMicrophone = async (deviceId?: string) => {
    stopMicrophone();
    setPermissionState('requesting');
    setErrorMessage('');

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setPermissionState('granted');
      await loadDevices();

      // Setup Web Audio Analyzer
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(mediaStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      // NOTE: Intentionally DO NOT connect to ctx.destination to prevent acoustic screech / loop feedback
      analyserRef.current = analyser;

      drawWaveform();

      emitRunRich(runTokenRef.current, {
        status: 'passed',
        details: 'Browser audio input stream active. Signal level and waveform measured.',
        metrics: { deviceLabel: mediaStream.getAudioTracks()[0]?.label || 'Microphone' },
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage(t.micTest.deniedMessage);
        setShowDeniedModal(true);
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermissionState('error');
        setErrorMessage(t.common.deviceUnavailable);
      } else {
        setPermissionState('error');
        setErrorMessage(error.message || t.common.error);
      }
      emitRunRich(runTokenRef.current, {
        status: 'failed',
        details: error.message || 'Microphone access failed.',
      });
    }
  };

  // Draw waveform and measure RMS level
  const drawWaveform = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let currentPeak = 0;

    const render = () => {
      if (!analyserRef.current) return;
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS volume level
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const levelPercent = Math.min(100, Math.round(rms * 280));
      setInputLevel(levelPercent);

      if (levelPercent > currentPeak) {
        currentPeak = levelPercent;
        setPeakLevel(currentPeak);
      }

      // Render Oscillogram
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#131B27';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.lineWidth = 2;
          ctx.strokeStyle = '#14B8A6';
          ctx.beginPath();

          const sliceWidth = (canvas.width * 1.0) / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        }
      }
    };

    render();
  };

  // 5-second sample recording for user self-monitoring
  const startRecordingSample = () => {
    if (!streamRef.current) return;

    if (recordedAudioUrlRef.current) {
      URL.revokeObjectURL(recordedAudioUrlRef.current);
      recordedAudioUrlRef.current = null;
      setRecordedAudioUrl(null);
    }

    try {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          recordedAudioUrlRef.current = url;
          setRecordedAudioUrl(url);
        }
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
      setRecordTimeLeft(5);

      countdownIntervalRef.current = setInterval(() => {
        setRecordTimeLeft((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            if (recorder.state === 'recording') {
              try {
                recorder.stop();
              } catch {
                // ignore
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setIsRecording(false);
    }
  };

  // Unmount & route cleanup. stopMicrophone is a stable closure over refs and
  // stable controller functions, so listing it here would not change behavior
  // and would only risk re-running cleanup if its identity ever changed.
  useEffect(() => {
    return () => {
      stopMicrophone();
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
        recordedAudioUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup for refs and stable controller functions
  }, []);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Mic className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.micTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.micTest.shortDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          {permissionState !== 'granted' ? (
            <button
              id="btn-start-mic"
              onClick={() => startMicrophone(selectedDeviceId)}
              disabled={permissionState === 'requesting'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              {permissionState === 'requesting' ? t.micTest.requesting : t.micTest.grantPermission}
            </button>
          ) : (
            <button
              id="btn-stop-mic"
              onClick={stopMicrophone}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              <MicOff className="w-4 h-4" />
              {t.common.stopTest}
            </button>
          )}
        </div>
      </div>

      {/* Device Selector */}
      {devices.length > 1 && permissionState === 'granted' && (
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="mic-device-select" className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
            {t.micTest.selectDevice}
          </label>
          <select
            id="mic-device-select"
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startMicrophone(e.target.value);
            }}
            className="text-sm bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || t.micTest.defaultDevice}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Permission Denied or Error Banner */}
      {permissionState === 'denied' && (
        <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-medium">{t.common.permissionDenied}</p>
            <p className="mt-1 text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {permissionState === 'error' && (
        <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <p className="font-medium">{t.common.error}</p>
            <p className="mt-1 text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Live Meters & Waveform Area */}
      {permissionState === 'granted' ? (
        <div className="mt-6 space-y-6">
          {/* Level Meters */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1.5">
              <span>{t.micTest.inputLevel}</span>
              <span className="font-mono-num">{inputLevel}% (Peak: {peakLevel}%)</span>
            </div>
            <div className="w-full h-3 bg-[#F1F4F7] dark:bg-[#192332] rounded-full overflow-hidden border border-[#DFE5EB] dark:border-[#223043]">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  inputLevel > 85 ? 'bg-red-500' : inputLevel > 50 ? 'bg-amber-500' : 'bg-[#0F766E] dark:bg-[#14B8A6]'
                }`}
                style={{ width: `${inputLevel}%` }}
              />
            </div>
          </div>

          {/* Real-time Oscillogram Canvas */}
          <div>
            <div className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1.5">
              {t.micTest.waveform}
            </div>
            <canvas
              ref={canvasRef}
              width={640}
              height={120}
              className="w-full h-[120px] rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-[#131B27]"
            />
          </div>

          {/* 5-second Recording Section */}
          <div className="p-4 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">
                  {t.micTest.recordVoice}
                </p>
                <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">
                  {t.micTest.recordPrompt}
                </p>
              </div>

              {!isRecording ? (
                <button
                  id="btn-record-5s"
                  onClick={startRecordingSample}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t.micTest.recordVoice}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400 animate-pulse">
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>{t.micTest.recordingTime} ({recordTimeLeft}s)</span>
                </div>
              )}
            </div>

            {/* Playback player */}
            {recordedAudioUrl && (
              <div className="mt-4 pt-3 border-t border-[#DFE5EB] dark:border-[#223043] flex flex-col sm:flex-row items-center gap-3">
                <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">{t.micTest.playbackPrompt}</p>
                <audio controls src={recordedAudioUrl} className="h-8 max-w-xs" />
                <a
                  href={recordedAudioUrl}
                  download="devicetry-mic-sample.webm"
                  className="inline-flex items-center gap-1.5 text-xs text-[#0F766E] dark:text-[#14B8A6] hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.micTest.downloadRecording}
                </a>
              </div>
            )}

            <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-2 italic">
              {t.micTest.cleanFeedbackNotice}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <Mic className="w-10 h-10 text-[#5F6B7A] dark:text-[#9AA6B8] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] max-w-md mx-auto">
            {t.micTest.startPrompt}
          </p>
        </div>
      )}

      {/* Test result — in-card, directly under the test area */}
      <TestResultBanner result={result} onClear={clear} />

      {/* How to interpret & Troubleshooting */}
      <div className="mt-8 pt-6 border-t border-[#DFE5EB] dark:border-[#223043] grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <div>
          <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
            {t.micTest.interpretationTitle}
          </h3>
          <p className="leading-relaxed">{t.micTest.interpretationText}</p>
          <p className="mt-2 text-[11px] text-[#8996A6] italic">
            {t.micTest.hardwareLimitationNotice}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
            {t.micTest.troubleshootingTitle}
          </h3>
          <ul className="space-y-1.5 list-disc list-inside">
            {t.micTest.troubleshootingSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Permission denied modal */}
      <PermissionDeniedModal
        open={showDeniedModal}
        kind="microphone"
        onRetry={() => {
          setShowDeniedModal(false);
          startMicrophone(selectedDeviceId || undefined);
        }}
        onClose={() => setShowDeniedModal(false)}
      />
    </div>
  );
}
