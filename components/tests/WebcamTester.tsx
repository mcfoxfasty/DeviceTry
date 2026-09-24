'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, Download, AlertTriangle, CheckCircle, Video } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { PermissionDeniedModal } from '@/components/PermissionDeniedModal';
import { TestResultBanner, useTestResult } from '@/components/TestResultBanner';
import { CameraSession } from '@/lib/testing/cameraSession';
import {
  createFrameGate,
  supportsRequestVideoFrameCallback,
} from '@/lib/testing/videoFrameGate';

interface WebcamTesterProps {
  t: Translations;
  onRecordResult?: (result: {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured';
    details: string;
    metrics?: Record<string, unknown>;
  }) => void;
  onResultClear?: () => void;
  /**
   * Guided inspection only: fired when the browser refused camera access or
   * reported no camera. Lets the host record a BLOCKED step — distinct from
   * a failed camera — so a denied permission is never reported as faulty
   * hardware.
   */
  onPermissionBlocked?: (reason: 'denied' | 'unavailable') => void;
  /** Registry identity for the in-card banner's safe share + history. */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
}

export function WebcamTester({
  t,
  onRecordResult,
  onResultClear,
  onPermissionBlocked,
  toolId,
  toolTitle,
  toolSlug,
}: WebcamTesterProps) {
  const { result, emitRunRich, clear, invalidate, startRun, currentRun } = useTestResult({
    onRecordResult,
    onResultClear,
  });
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDeniedModal, setShowDeniedModal] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  // Read at event time so the permission path never closes over a stale prop.
  const onBlockedRef = useRef(onPermissionBlocked);
  useEffect(() => {
    onBlockedRef.current = onPermissionBlocked;
  }, [onPermissionBlocked]);

  // Video stream metrics
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [observedFps, setObservedFps] = useState<number | null>(null);
  const [fpsSupported, setFpsSupported] = useState<boolean>(true);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // Stable references for deterministic cleanup without stale closures
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFrameCallbackIdRef = useRef<number | null>(null);
  const fpsFrameCountRef = useRef<number>(0);
  const fpsLastTimeRef = useRef<number>(0);
  const snapshotUrlRef = useRef<string | null>(null);
  /** Frame-delivery gate for the CURRENT stream observation. */
  const frameGateRef = useRef<ReturnType<typeof createFrameGate> | null>(null);
  /** Fallback readyState poll handle (browsers without rVFC). */
  const fallbackPollRef = useRef<number | null>(null);
  // Set on unmount only: in-flight getUserMedia must never touch state after it.
  const unmountedRef = useRef<boolean>(false);

  // Camera acquisition guard: binds each getUserMedia attempt to the run
  // token captured at attempt start; stale resolutions are stopped and ignored.
  const [session] = useState(() => new CameraSession<MediaStream>());

  /** Pure resource teardown — no lifecycle or result-state changes. */
  const releaseCameraResources = useCallback(() => {
    // 1. Cancel requestVideoFrameCallback if supported and active
    if (
      videoRef.current &&
      videoFrameCallbackIdRef.current !== null &&
      'cancelVideoFrameCallback' in videoRef.current
    ) {
      try {
        (
          videoRef.current as unknown as {
            cancelVideoFrameCallback: (id: number) => void;
          }
        ).cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
      } catch {
        // ignore
      }
      videoFrameCallbackIdRef.current = null;
    }

    // 2. Stop and release all adopted tracks
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

    // 3. Clear video element source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
    }

    // 4. Release any still-adopted-but-not-yet-attached stream
    session.releaseAll();
  }, [session]);

  /** Device enumeration guarded against stale runs and unmount. */
  const loadCameras = useCallback(
    async (runToken: number) => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        if (unmountedRef.current || runToken !== currentRun()) return;
        const cameras = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(cameras);
        if (cameras.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(cameras[0].deviceId);
        }
      } catch {
        // ignore
      }
    },
    [currentRun, selectedDeviceId]
  );

  /** Explicit user Stop: invalidate pending callbacks, then release resources.
   *  Resource cleanup, not Reset — a completed guided result is preserved. */
  const stopCamera = useCallback(() => {
    session.invalidate();
    releaseCameraResources();
    setResolution(null);
    setObservedFps(null);
    setPermissionState('idle');
  }, [session, releaseCameraResources]);

  /** Schedule the next rVFC frame, integrating FPS counting (single loop). */
  const scheduleNextFrame = useCallback((cb: () => void) => {
    const videoEl = videoRef.current;
    if (!videoEl || !('requestVideoFrameCallback' in videoEl)) return;
    const id = (
      videoEl as unknown as {
        requestVideoFrameCallback: (cb: () => void) => number;
      }
    ).requestVideoFrameCallback(() => {
      // FPS accounting per delivered frame.
      fpsFrameCountRef.current += 1;
      const now = performance.now();
      if (fpsLastTimeRef.current === 0) {
        fpsLastTimeRef.current = now;
      }
      const elapsed = now - fpsLastTimeRef.current;
      if (elapsed >= 1000) {
        setObservedFps(Math.round((fpsFrameCountRef.current * 1000) / elapsed));
        fpsFrameCountRef.current = 0;
        fpsLastTimeRef.current = now;
      }
      cb();
    });
    videoFrameCallbackIdRef.current = id;
  }, []);

  // (FPS counting is integrated into scheduleNextFrame — one unified loop
  // serves frame delivery, FPS measurement, and the resolution readout.)

  const startCamera = useCallback(
    async (deviceId?: string) => {
      // Exactly ONE lifecycle transition per start/restart/device change:
      // startRun() clears the previous verdict and the host/guided result,
      // and returns the immutable token this request is bound to.
      const runToken = startRun();
      session.begin(runToken);

      releaseCameraResources();
      setPermissionState('requesting');
      setErrorMessage('');
      setResolution(null);
      setObservedFps(null);

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Adopt only if this attempt is still live; stale resolutions have
        // every returned track stopped and update no UI/result.
        const adoption = session.resolve(runToken, mediaStream);
        if (unmountedRef.current || !adoption.live) {
          return;
        }

        streamRef.current = adoption.stream;
        setPermissionState('granted');
        await loadCameras(runToken);

        if (unmountedRef.current || runToken !== currentRun() || streamRef.current !== mediaStream) {
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          // Frame-delivery gate: passed requires an ACTUALLY delivered frame.
          // Metadata/dimensions alone (onloadedmetadata) are not evidence.
          const gate = createFrameGate({
            runToken,
            streamIdentity: mediaStream,
            isCurrent: () =>
              !unmountedRef.current &&
              runToken === currentRun() &&
              streamRef.current === mediaStream,
          });
          frameGateRef.current = gate;

          if (supportsRequestVideoFrameCallback(videoRef.current)) {
            // Report once per observation: a delivered frame is one verdict;
            // the loop keeps running for FPS accounting, but identical verdict
            // re-emissions are deduped by the ResultController anyway.
            let reported = false;
            const onFrame = () => {
              if (!gate.isLive()) return;
              const w = videoRef.current?.videoWidth ?? 0;
              const h = videoRef.current?.videoHeight ?? 0;
              const decision = gate.onFrame(runToken, mediaStream);
              if (decision.delivered && !reported && w > 0 && h > 0) {
                reported = true;
                setResolution({ width: w, height: h });
                emitRunRich(runToken, {
                  status: 'passed',
                  details: `Video frames actually delivered at ${w}x${h} (confirmed via requestVideoFrameCallback).`,
                  metrics: {
                    width: w,
                    height: h,
                    deviceLabel: mediaStream.getVideoTracks()[0]?.label || 'Webcam',
                    frameEvidence: 'requestVideoFrameCallback',
                  },
                });
              }
              scheduleNextFrame(onFrame);
            };
            scheduleNextFrame(onFrame);
          } else {
            // Documented fallback (no rVFC, e.g. older Firefox/Safari): poll
            // readyState; HAVE_CURRENT_DATA + non-zero dimensions is the best
            // available evidence that a frame was decoded for display.
            setFpsSupported(false);
            setObservedFps(null);
            let pollReported = false;
            const poll = () => {
              if (!gate.isLive()) return;
              const decision = gate.checkFallbackReady(videoRef.current);
              if (decision.delivered && !pollReported) {
                pollReported = true;
                const w = videoRef.current?.videoWidth ?? 0;
                const h = videoRef.current?.videoHeight ?? 0;
                setResolution({ width: w, height: h });
                emitRunRich(runToken, {
                  status: 'passed',
                  details: `Video frames delivered at ${w}x${h} (readyState fallback — this browser does not expose requestVideoFrameCallback).`,
                  metrics: {
                    width: w,
                    height: h,
                    deviceLabel: mediaStream.getVideoTracks()[0]?.label || 'Webcam',
                    frameEvidence: 'readyState-fallback',
                  },
                });
                return;
              }
              fallbackPollRef.current = window.setTimeout(poll, 100);
            };
            fallbackPollRef.current = window.setTimeout(poll, 100);
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (unmountedRef.current || !session.reject(runToken)) {
          // Stale rejection after stop/device change/unmount: do not overwrite
          // the newer UI state with an old failure.
          return;
        }
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionState('denied');
          setErrorMessage(t.common.permissionDenied);
          setShowDeniedModal(true);
          // Guided inspection records a BLOCKED step, not a failed camera.
          onBlockedRef.current?.('denied');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setPermissionState('error');
          setErrorMessage(t.common.deviceUnavailable);
          onBlockedRef.current?.('unavailable');
        } else {
          setPermissionState('error');
          setErrorMessage(error.message || t.common.error);
        }
        emitRunRich(runToken, {
          status: 'failed',
          details: error.message || 'Camera access failed.',
        });
      }
    },
    [startRun, session, releaseCameraResources, loadCameras, currentRun, emitRunRich, scheduleNextFrame, t.common.permissionDenied, t.common.deviceUnavailable, t.common.error]
  );

  const takeSnapshot = () => {
    if (!videoRef.current || !resolution) return;

    if (snapshotUrlRef.current) {
      URL.revokeObjectURL(snapshotUrlRef.current);
      snapshotUrlRef.current = null;
      setSnapshotUrl(null);
    }

    const canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, resolution.width, resolution.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        snapshotUrlRef.current = url;
        setSnapshotUrl(url);
      }
    }, 'image/jpeg', 0.92);
  };

  // Unmount & route cleanup: invalidate + pure teardown, no setState, and the
  // completed guided result is NOT cleared.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      invalidate();
      session.invalidate();
      frameGateRef.current = null;
      if (fallbackPollRef.current !== null) {
        clearTimeout(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
      releaseCameraResources();
      if (snapshotUrlRef.current) {
        URL.revokeObjectURL(snapshotUrlRef.current);
        snapshotUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup for refs and stable functions
  }, []);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h2 className="text-xl font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            {t.webcamTest.title}
          </h2>
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">{t.webcamTest.shortDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          {permissionState !== 'granted' ? (
            <button
              id="btn-start-camera"
              onClick={() => startCamera(selectedDeviceId)}
              disabled={permissionState === 'requesting'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              {permissionState === 'requesting' ? t.common.loading : t.common.startTest}
            </button>
          ) : (
            <button
              id="btn-stop-camera"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              <CameraOff className="w-4 h-4" />
              {t.common.stopTest}
            </button>
          )}
        </div>
      </div>

      {/* Camera Selector */}
      {devices.length > 1 && permissionState === 'granted' && (
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="camera-device-select" className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
            {t.webcamTest.selectCamera}
          </label>
          <select
            id="camera-device-select"
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startCamera(e.target.value);
            }}
            className="text-sm bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Default Camera'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error & Permission alerts */}
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

      {/* Video Viewport & Technical Telemetry */}
      {permissionState === 'granted' ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Live Video Monitor */}
            <div className="lg:col-span-2 relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-[#DFE5EB] dark:border-[#223043] shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Live Overlay Badge */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>LIVE FEED</span>
              </div>
            </div>

            {/* Telemetry & Controls Panel */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8]">
                  {t.common.status}
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#DFE5EB] dark:border-[#223043]">
                    <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.webcamTest.deliveredResolution}</span>
                    <span className="font-mono-num font-semibold text-[#142033] dark:text-[#E9EEF4]">
                      {resolution ? `${resolution.width} × ${resolution.height}` : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-[#DFE5EB] dark:border-[#223043]">
                    <span className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.webcamTest.observedFps}</span>
                    <span className="font-mono-num font-semibold text-[#142033] dark:text-[#E9EEF4]">
                      {observedFps !== null ? (
                        `${observedFps} FPS`
                      ) : !fpsSupported ? (
                        <span className="text-[11px] font-normal text-[#8996A6]">Unsupported</span>
                      ) : (
                        'Measuring...'
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    id="btn-take-snapshot"
                    onClick={takeSnapshot}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-[#131B27] hover:bg-[#E6F4F2] text-[#142033] dark:text-[#E9EEF4] text-xs font-semibold rounded-lg border border-[#DFE5EB] dark:border-[#223043] transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
                    {t.webcamTest.takeSnapshot}
                  </button>
                </div>
              </div>

              {/* Snapshot Preview */}
              {snapshotUrl && (
                <div className="p-3 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
                  <div className="flex items-center justify-between mb-2 text-xs font-semibold text-[#142033] dark:text-[#E9EEF4]">
                    <span>{t.webcamTest.takeSnapshot}</span>
                    <a
                      href={snapshotUrl}
                      download="devicetry-webcam-snapshot.jpg"
                      className="text-[#0F766E] dark:text-[#14B8A6] hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      {t.webcamTest.downloadSnapshot}
                    </a>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={snapshotUrl}
                    alt="Webcam Snapshot"
                    className="w-full h-auto rounded-lg border border-[#DFE5EB] dark:border-[#223043]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <Video className="w-10 h-10 text-[#5F6B7A] dark:text-[#9AA6B8] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] max-w-md mx-auto">
            {t.webcamTest.startPrompt}
          </p>
        </div>
      )}

      {/* Test result — in-card, directly under the test area */}
      <TestResultBanner result={result} onClear={clear} toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />

      {/* Technical Interpretation & Troubleshooting */}
      <div className="mt-8 pt-6 border-t border-[#DFE5EB] dark:border-[#223043] grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        <div>
          <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
            {t.webcamTest.interpretationTitle}
          </h3>
          <p className="leading-relaxed">{t.webcamTest.interpretationText}</p>
          <p className="mt-2 text-[11px] text-[#8996A6] italic">
            {t.webcamTest.hardwareLimitationNotice}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-[#142033] dark:text-[#E9EEF4] text-sm mb-1.5">
            {t.webcamTest.troubleshootingTitle}
          </h3>
          <ul className="space-y-1.5 list-disc list-inside">
            {t.webcamTest.troubleshootingSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Permission denied modal */}
      <PermissionDeniedModal
        open={showDeniedModal}
        kind="camera"
        onRetry={() => {
          setShowDeniedModal(false);
          startCamera(selectedDeviceId || undefined);
        }}
        onClose={() => setShowDeniedModal(false)}
      />
    </div>
  );
}
