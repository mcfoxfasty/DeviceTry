'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, RefreshCw, Download, AlertTriangle, CheckCircle, Video } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface WebcamTesterProps {
  t: Translations;
  onRecordResult?: (result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive'; details: string; metrics?: Record<string, unknown> }) => void;
}

export function WebcamTester({ t, onRecordResult }: WebcamTesterProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Video stream metrics
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [observedFps, setObservedFps] = useState<number | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fpsFrameCountRef = useRef<number>(0);
  const fpsLastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const loadCameras = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const cameras = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(cameras);
      if (cameras.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(cameras[0].deviceId);
      }
    } catch {
      // ignore
    }
  };

  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setPermissionState('requesting');
    setErrorMessage('');

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setPermissionState('granted');
      await loadCameras();

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            setResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
            measureFps();
            onRecordResult?.({
              status: 'passed',
              details: `Camera operational at ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`,
              metrics: {
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
              },
            });
          }
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage(t.micTest.deniedMessage);
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermissionState('error');
        setErrorMessage(t.common.deviceUnavailable);
      } else {
        setPermissionState('error');
        setErrorMessage(error.message || t.common.error);
      }
      onRecordResult?.({
        status: 'failed',
        details: error.message || 'Camera access failed.',
      });
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setResolution(null);
    setObservedFps(null);
  };

  const measureFps = () => {
    fpsFrameCountRef.current = 0;
    fpsLastTimeRef.current = performance.now();

    const loop = (now: number) => {
      fpsFrameCountRef.current++;
      const elapsed = now - fpsLastTimeRef.current;

      if (elapsed >= 1000) {
        const fps = Math.round((fpsFrameCountRef.current * 1000) / elapsed);
        setObservedFps(fps);
        fpsFrameCountRef.current = 0;
        fpsLastTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !resolution) return;
    const canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, resolution.width, resolution.height);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    setSnapshotUrl(url);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
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
              <Video className="w-4 h-4" />
              {permissionState === 'requesting' ? t.micTest.requesting : t.webcamTest.startPrompt}
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

      {/* Device Selector */}
      {devices.length > 1 && permissionState === 'granted' && (
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="cam-device-select" className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
            {t.webcamTest.selectCamera}
          </label>
          <select
            id="cam-device-select"
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startCamera(e.target.value);
            }}
            className="text-sm bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error / Denied Banner */}
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

      {/* Video Viewport & Real-time Metrics */}
      {permissionState === 'granted' ? (
        <div className="mt-6 space-y-4">
          <div className="relative aspect-video max-w-2xl mx-auto rounded-lg overflow-hidden bg-black border border-[#DFE5EB] dark:border-[#223043]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Overlaid Stream Metrics */}
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded text-xs font-mono-num flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </span>
              {resolution && (
                <span>
                  <bdi>{resolution.width} × {resolution.height}</bdi>
                </span>
              )}
              {observedFps !== null && (
                <span>
                  <bdi>{observedFps} FPS</bdi>
                </span>
              )}
            </div>

            {/* Snapshot trigger */}
            <div className="absolute bottom-3 right-3">
              <button
                id="btn-take-snapshot"
                onClick={takeSnapshot}
                className="px-3 py-1.5 bg-white/90 hover:bg-white text-[#142033] font-medium text-xs rounded shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-[#0F766E]" />
                {t.webcamTest.takeSnapshot}
              </button>
            </div>
          </div>

          {/* Snapshot review */}
          {snapshotUrl && (
            <div className="p-4 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={snapshotUrl}
                  alt="Camera test snapshot"
                  className="w-20 h-14 object-cover rounded border border-[#DFE5EB] dark:border-[#223043]"
                />
                <div>
                  <p className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4]">
                    {t.webcamTest.takeSnapshot}
                  </p>
                  <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
                    {resolution ? `${resolution.width}×${resolution.height} JPG` : ''}
                  </p>
                </div>
              </div>

              <a
                href={snapshotUrl}
                download="devicetry-camera-snapshot.jpg"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-medium rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t.webcamTest.downloadSnapshot}
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center">
          <Camera className="w-10 h-10 text-[#5F6B7A] dark:text-[#9AA6B8] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] max-w-md mx-auto">
            {t.webcamTest.startPrompt}
          </p>
        </div>
      )}

      {/* Troubleshooting & Interpretation */}
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
    </div>
  );
}
