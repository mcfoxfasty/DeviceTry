'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Square, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { PermissionDeniedModal } from '@/components/PermissionDeniedModal';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import { MicSignalObserver } from '@/lib/testing/micSignal';
import { WAV_MIME_TYPE, createWavBlob } from '@/lib/testing/wavEncoder';
import { PcmAccumulator, describeError } from '@/lib/testing/pcmRecorder';

/** Duration of the self-monitoring sample clip (seconds). */
const MIC_SAMPLE_SECONDS = 5;
/**
 * Frames per audio callback while tapping PCM for the sample clip. 4096 is
 * the value Safari and Chromium handle best and keeps each copy small.
 */
const PCM_BUFFER_FRAMES = 4096;

interface MicrophoneTesterProps {
  t: Translations;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
  onResultClear?: () => void;
  /**
   * Guided inspection only: fired when the browser refused microphone
   * access or reported no input device. Lets the host record a BLOCKED
   * step — distinct from a failed microphone — so a denied permission is
   * never reported as faulty hardware.
   */
  onPermissionBlocked?: (reason: 'denied' | 'unavailable') => void;
  /** Guided-inspection label so the user knows exactly which test to start. */
  startButtonLabel?: string;
  /** Registry identity for the in-card banner's safe share + history. */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
}

export function MicrophoneTester({
  t,
  onRecordResult,
  onResultClear,
  onPermissionBlocked,
  startButtonLabel,
  toolId,
  toolTitle,
  toolSlug,
}: MicrophoneTesterProps) {
  const { result, emitRunRich, clear, reset, startRun, invalidate, currentRun } = useTestResult({
    onRecordResult,
    onResultClear,
  });
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDeniedModal, setShowDeniedModal] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [peakLevel, setPeakLevel] = useState<number>(0);
  // Read at event time so the permission path never closes over a stale prop.
  const onBlockedRef = useRef(onPermissionBlocked);
  useEffect(() => {
    onBlockedRef.current = onPermissionBlocked;
  }, [onPermissionBlocked]);

  // Recording sample state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordTimeLeft, setRecordTimeLeft] = useState<number>(MIC_SAMPLE_SECONDS);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Stable references for deterministic cleanup without stale closures
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedAudioUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // PCM tap for the sample clip. These are separate from the analyser graph so
  // the meter/waveform keep running untouched while a sample is captured.
  const sampleSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sampleProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sampleSinkRef = useRef<GainNode | null>(null);
  const sampleAccumulatorRef = useRef<PcmAccumulator | null>(null);
  // Track the stream request in flight so a resolution after stop/device
  // change/reset can be rejected and its obsolete tracks stopped immediately.
  const pendingStreamRef = useRef<MediaStream | null>(null);
  // Set on unmount only: in-flight getUserMedia must never touch state after it.
  const unmountedRef = useRef<boolean>(false);
  // Requires a SUSTAINED non-trivial level before "usable signal" is credited:
  // permission granted or a connected stream alone is NOT a passed observation.
  const signalObserverRef = useRef<MicSignalObserver>(new MicSignalObserver());

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
    // Explicit user Stop (Phase 1): releases devices and measurement
    // resources while PRESERVING the last verdict on screen. invalidate()
    // bumps the run token — in-flight getUserMedia resolutions, waveform
    // frames, countdown ticks, and recorder callbacks can no longer report —
    // but unlike startRun() it never clears the visible verdict or the
    // host/guided result. Results remain until the user explicitly clears
    // them or actually starts a new attempt.

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

    // 3. Detach any in-flight PCM tap for the sample clip (the samples are
    //    dropped — an interrupted sample is never published as a clip).
    releaseSampleTap();

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

    // A new attempt begins: exactly one lifecycle transition clears the
    // previous attempt's verdict and the host/guided result, and returns the
    // immutable token this getUserMedia request is bound to (captured NOW,
    // never inside the later promise resolution).
    const runToken = startRun();

    setPermissionState('requesting');
    setErrorMessage('');

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (unmountedRef.current || runToken !== currentRun()) {
        // Obsolete request: stop every track immediately and report nothing.
        mediaStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        return;
      }

      pendingStreamRef.current = mediaStream;
      streamRef.current = mediaStream;
      setPermissionState('granted');
      await loadDevices();

      if (unmountedRef.current || runToken !== currentRun()) {
        return;
      }

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

      signalObserverRef.current.reset();
      drawWaveform();

      // Access is NOT a verdict: the stream merely connects. The verdict is
      // emitted from the analysis loop once a sustained usable signal is
      // observed (or remains honestly inconclusive if the input stays silent).
    } catch (err: unknown) {
      const error = err as Error;
      if (unmountedRef.current || runToken !== currentRun()) {
        // Stale rejection after stop/device change/unmount: UI already reflects
        // the newer state; do not overwrite it with an old failure.
        return;
      }
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage(t.micTest.deniedMessage);
        setShowDeniedModal(true);
        // Guided inspection needs to distinguish "the browser refused access"
        // from "the microphone is faulty" — only the host can say that.
        onBlockedRef.current?.('denied');
        // A refused permission is not a completed microphone measurement.
        return;
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermissionState('error');
        setErrorMessage(t.common.deviceUnavailable);
        onBlockedRef.current?.('unavailable');
        // No device is an environment/blocked state, not a failed measurement.
        return;
      } else {
        setPermissionState('error');
        setErrorMessage(error.message || t.common.error);
      }
      emitRunRich(runToken, {
        status: 'failed',
        details: error.message || 'Microphone access failed.',
      });
    }
  };

  // Draw waveform and measure RMS level. The analysis loop owns the verdict:
  // sustained signal → passed; silence stays inconclusive (never failed —
  // digital silence alone is not proof of hardware failure).
  const drawWaveform = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let currentPeak = 0;
    const runTokenAtStart = currentRun();

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

      // Feed the sustained-signal observer and settle the verdict once.
      const observer = signalObserverRef.current;
      observer.observe(levelPercent);
      if (observer.hasUsableSignal && !observer.observedReported) {
        observer.observedReported = true;
        emitRunRich(runTokenAtStart, {
          status: 'passed',
          details: `Usable input signal observed (sustained relative level, peak ${observer.peakLevelPercent}% of meter). Waveform rendered from the live stream.`,
          metrics: {
            deviceLabel: streamRef.current?.getAudioTracks()[0]?.label || 'Microphone',
            peakLevelPercent: observer.peakLevelPercent,
            measurement: 'relative input level (RMS, not calibrated SPL)',
          },
        });
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

  /**
   * Detach the PCM tap. Deliberately does NOT close the AudioContext — the
   * level meter and waveform own it and must keep running afterwards.
   */
  const releaseSampleTap = () => {
    const processor = sampleProcessorRef.current;
    if (processor) {
      // Detach the callback first so no late audio block appends after teardown.
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
      } catch {
        // already disconnected
      }
      sampleProcessorRef.current = null;
    }
    const source = sampleSourceRef.current;
    if (source) {
      try {
        source.disconnect();
      } catch {
        // already disconnected
      }
      sampleSourceRef.current = null;
    }
    const sink = sampleSinkRef.current;
    if (sink) {
      try {
        sink.disconnect();
      } catch {
        // already disconnected
      }
      sampleSinkRef.current = null;
    }
    sampleAccumulatorRef.current = null;
  };

  /**
   * Encode the captured PCM as a genuine WAV and publish it for playback and
   * download.
   *
   * There is no fallback. If nothing was captured, or the samples cannot be
   * encoded, the sample is reported as inconclusive with no player shown — the
   * clip is never offered in a container that will not open.
   */
  const finishRecordingSample = () => {
    const accumulator = sampleAccumulatorRef.current;
    releaseSampleTap();
    setIsRecording(false);

    if (!accumulator || accumulator.frameCount <= 0) {
      emitRunRich(currentRun(), {
        status: 'inconclusive',
        details: 'The audio sample capture produced no PCM samples, so no clip was saved.',
      });
      return;
    }

    let wav: ArrayBuffer | null = null;
    try {
      wav = accumulator.toWav();
    } catch (err: unknown) {
      const detail = describeError(err);
      emitRunRich(currentRun(), {
        status: 'failed',
        details: `The audio sample could not be encoded as WAV — ${detail}`,
      });
      return;
    }

    if (!wav) {
      emitRunRich(currentRun(), {
        status: 'inconclusive',
        details: 'The audio sample produced no samples to encode.',
      });
      return;
    }

    const audioBlob = createWavBlob(wav);
    const url = URL.createObjectURL(audioBlob);
    recordedAudioUrlRef.current = url;
    setRecordedAudioUrl(url);
  };

  // Self-monitoring sample clip. The audio is captured as raw PCM through a Web
  // Audio tap and written out as a genuine WAV on completion. MediaRecorder is
  // deliberately not used: on iOS Safari it produced a blob that would not open
  // once downloaded, and its extension fell back to a hard-coded .webm.
  const startRecordingSample = () => {
    const context = audioContextRef.current;
    const stream = streamRef.current;
    if (!stream || !context || context.state === 'closed') {
      emitRunRich(currentRun(), {
        status: 'inconclusive',
        details:
          'The microphone is not running, so a local sample clip cannot be captured. Start the microphone test first.',
      });
      return;
    }

    if (recordedAudioUrlRef.current) {
      URL.revokeObjectURL(recordedAudioUrlRef.current);
      recordedAudioUrlRef.current = null;
      setRecordedAudioUrl(null);
    }

    try {
      const accumulator = new PcmAccumulator(context.sampleRate, MIC_SAMPLE_SECONDS + 1);
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(PCM_BUFFER_FRAMES, 1, 1);
      const sink = context.createGain();
      // The processor only runs while connected to the destination, but routing
      // a live microphone there would be audible feedback. A zero-gain sink
      // keeps the graph pulled and completely silent.
      sink.gain.value = 0;

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        accumulator.append(event.inputBuffer.getChannelData(0));
      };

      sampleSourceRef.current = source;
      sampleProcessorRef.current = processor;
      sampleSinkRef.current = sink;
      sampleAccumulatorRef.current = accumulator;

      source.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination);
    } catch (err: unknown) {
      const detail = describeError(err);
      releaseSampleTap();
      setIsRecording(false);
      emitRunRich(currentRun(), {
        status: 'failed',
        details: `Could not start the audio sample capture — ${detail}`,
      });
      return;
    }

    setIsRecording(true);
    setRecordTimeLeft(MIC_SAMPLE_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setRecordTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          finishRecordingSample();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Unmount & route cleanup. Unmount must NOT clear a legitimately recorded
  // guided result: it invalidates in-flight work (token bump, no host clear)
  // and releases resources directly — the same preserve-the-verdict
  // semantics as an explicit Stop, minus UI state owned by a live component.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      invalidate();
      // Release live resources without touching result state.
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      releaseSampleTap();
      if (pendingStreamRef.current) {
        pendingStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        pendingStreamRef.current = null;
      }
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
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {
          // ignore
        }
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
        recordedAudioUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup for refs and stable controller functions
  }, []);

  // The sample clip is always a genuine WAV file, so the extension always is.
  // There is deliberately no "?? 'webm'" fallback any more: a silent wrong
  // extension was exactly how an unopenable download was produced before.
  const sampleExtension = 'wav';

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
              {permissionState === 'requesting'
                ? t.micTest.requesting
                : startButtonLabel ?? t.micTest.grantPermission}
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
                <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
                  {t.micTest.playbackPrompt}{' '}
                  {/* The clip is always a genuine WAV; naming the format on screen
                      makes the on-device result verifiable at a glance. */}
                  <span className="font-mono text-[10px] text-[#0F766E] dark:text-[#14B8A6]">
                    ({WAV_MIME_TYPE})
                  </span>
                </p>
                <audio
                  controls
                  src={recordedAudioUrl}
                  preload="metadata"
                  playsInline
                  className="h-8 max-w-xs"
                />
                <a
                  href={recordedAudioUrl}
                  download={`devicetry-mic-sample.${sampleExtension}`}
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
      <TestResultBanner result={result} onClear={clear} toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />

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
