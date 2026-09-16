'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, FlipHorizontal, ZoomIn, ZoomOut, Download, AlertCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

export function OnlineMirrorTester({ onResultUpdate }: ToolComponentProps) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, [stream]);

  const startMirror = async () => {
    setErrorMsg(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
        audio: false,
      });

      setStream(mediaStream);
      setIsActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }

      if (onResultUpdate) {
        onResultUpdate('passed', 'Mirror camera feed active');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Camera access denied or unavailable');
      if (onResultUpdate) {
        onResultUpdate('failed', error.message);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = `devicetry-mirror-snapshot-${Date.now()}.jpg`;
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

      {/* Main Mirror Viewport */}
      <div className="relative rounded-2xl bg-[#111D30] border border-[#223043] overflow-hidden flex flex-col items-center justify-center min-h-[420px]">
        {isActive ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-[560px] object-cover transition-transform duration-150"
              style={{
                transform: `${isMirrored ? 'scaleX(-1)' : 'scaleX(1)'} scale(${zoomLevel})`,
              }}
            />
          </div>
        ) : (
          <div className="text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0F766E]/20 text-[#14B8A6] flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#E9EEF4]">Online Mirror Camera Preview</h3>
              <p className="text-xs text-[#9AA6B8] mt-1 max-w-sm mx-auto">
                Turn on your camera to check appearance, lighting, and framing with zero cloud transmission.
              </p>
            </div>
            <button
              onClick={startMirror}
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0D665F] text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm"
            >
              Enable Mirror
            </button>
          </div>
        )}

        {/* Floating overlay controls when active */}
        {isActive && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111D30]/90 backdrop-blur-md border border-[#223043] text-white text-xs shadow-lg">
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className="px-3 py-1.5 rounded-lg bg-[#192332] hover:bg-[#223043] flex items-center gap-1.5 cursor-pointer font-medium"
              title="Flip Horizontal"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              <span>{isMirrored ? 'Mirrored' : 'Natural'}</span>
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.25))}
              disabled={zoomLevel <= 1}
              className="p-1.5 rounded-lg bg-[#192332] hover:bg-[#223043] disabled:opacity-40 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="font-mono text-[11px] px-1">{zoomLevel.toFixed(1)}x</span>

            <button
              onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
              disabled={zoomLevel >= 3}
              className="p-1.5 rounded-lg bg-[#192332] hover:bg-[#223043] disabled:opacity-40 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={takeSnapshot}
              className="px-3 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Snapshot
            </button>

            <button
              onClick={stopStream}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 font-semibold cursor-pointer"
            >
              Turn Off
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
