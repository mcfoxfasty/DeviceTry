'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, FlipHorizontal, ZoomIn, ZoomOut, Download, AlertCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { CameraSession } from '@/lib/testing/cameraSession';
import {
  attachStreamToVideo,
  readyStateIndicatesDeliveredFrame,
  supportsRequestVideoFrameCallback,
  FRAME_EVIDENCE_TIMEOUT_MS,
  VideoFrameSource,
} from '@/lib/testing/videoFrameGate';

interface ToolComponentProps {
  t: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive', details?: string) => void;
}

/**
 * Shared metrics for every overlay control.
 *
 * On a phone the controls wrap inside the preview instead of running off both
 * edges, and each keeps a comfortable tap target: min-h-9/min-w-9 (36px) with
 * horizontal padding, and labels that can never break mid-word. From `sm` up
 * the original compact 28px pill metrics are restored, so the desktop layout
 * is unchanged.
 */
const CONTROL_BUTTON =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg min-h-9 min-w-9 px-3 sm:min-h-7 sm:min-w-7 sm:py-1.5 cursor-pointer';

export function OnlineMirrorTester({ onResultUpdate }: ToolComponentProps) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Session state lives in refs so stopStream stays a stable callback and the
  // unmount cleanup cannot race a pending getUserMedia resolution.
  const sessionRef = useRef<CameraSession<MediaStream>>(new CameraSession<MediaStream>());
  const runTokenRef = useRef(0);
  const mountedRef = useRef(true);
  /** Frame-verification handles, so Stop/unmount can cancel a pending check. */
  const frameTimerRef = useRef<number | null>(null);
  const rvfcIdRef = useRef<number | null>(null);
  /** Bumped on every stop so a superseded frame check resolves instead of hanging. */
  const verifyTokenRef = useRef(0);

  /** Cancel the pending frame verification (poll timer + frame callback). */
  const clearFrameWatch = useCallback(() => {
    if (frameTimerRef.current !== null) {
      window.clearTimeout(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    const id = rvfcIdRef.current;
    const el = videoRef.current;
    // Read the id BEFORE nulling it: cancel needs the id it was given.
    if (id !== null && el && 'cancelVideoFrameCallback' in el) {
      try {
        (
          el as unknown as { cancelVideoFrameCallback: (frameId: number) => void }
        ).cancelVideoFrameCallback(id);
      } catch {
        // ignore: the element may already be detached
      }
    }
    rvfcIdRef.current = null;
  }, []);

  /** The <video> is always mounted, so this resolves on the first tick in practice. */
  const waitForVideoElement = useCallback(async (): Promise<HTMLVideoElement | null> => {
    if (videoRef.current) return videoRef.current;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      if (!mountedRef.current) return null;
      if (videoRef.current) return videoRef.current;
    }
    return null;
  }, []);

  /**
   * Resolve once a frame is REALLY being delivered, or null if none arrives
   * within the timeout. A resolved getUserMedia stream is not evidence of a
   * live preview, so "passed" must wait for this.
   */
  const verifyLiveFrames = useCallback(
    (el: HTMLVideoElement, token: number): Promise<VideoFrameSource | null> => {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (source: VideoFrameSource | null) => {
          if (settled) return;
          settled = true;
          clearFrameWatch();
          resolve(source);
        };

        // Preferred, precise evidence when the browser offers it.
        if (supportsRequestVideoFrameCallback(el)) {
          try {
            const rvfcEl = el as HTMLVideoElement & {
              requestVideoFrameCallback: (cb: () => void) => number;
            };
            rvfcIdRef.current = rvfcEl.requestVideoFrameCallback(() =>
              finish('requestVideoFrameCallback')
            );
          } catch {
            // fall through to the readyState safety net
          }
        }

        // Safety net for both cases: a paused or unstarted element never
        // reaches HAVE_CURRENT_DATA, so this also bounds a silent stall.
        const startedAt = Date.now();
        const poll = () => {
          if (settled) return;
          if (token !== verifyTokenRef.current) {
            finish(null);
            return;
          }
          if (readyStateIndicatesDeliveredFrame(el)) {
            finish('readyState-fallback');
            return;
          }
          if (Date.now() - startedAt >= FRAME_EVIDENCE_TIMEOUT_MS) {
            finish(null);
            return;
          }
          frameTimerRef.current = window.setTimeout(poll, 200);
        };
        frameTimerRef.current = window.setTimeout(poll, 200);
      });
    },
    [clearFrameWatch]
  );

  const stopStream = useCallback(() => {
    // Supersede any frame check still waiting, then release the hardware.
    runTokenRef.current += 1;
    verifyTokenRef.current = runTokenRef.current;
    clearFrameWatch();
    sessionRef.current.invalidate();
    sessionRef.current.releaseAll();
    const el = videoRef.current;
    if (el) {
      el.srcObject = null;
      try {
        el.pause();
      } catch {
        // ignore
      }
    }
    setIsActive(false);
    setIsRequesting(false);
  }, [clearFrameWatch]);

  const startMirror = async () => {
    if (isRequesting || isActive) return; // prevent concurrent pending requests
    setErrorMsg(null);
    setIsRequesting(true);
    // New observation: invalidate pending work from any previous attempt,
    // then mint the immutable token for THIS attempt (captured at begin —
    // never re-read inside the later promise resolution).
    sessionRef.current.invalidate();
    const token = ++runTokenRef.current;
    verifyTokenRef.current = token;
    if (!sessionRef.current.begin(token)) {
      setIsRequesting(false);
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
        audio: false,
      });
      const result = sessionRef.current.resolve(token, mediaStream);
      if (!mountedRef.current || !result.live) {
        // Superseded (Turn Off / restart / unmount won): the session already
        // stopped every returned track. Update nothing.
        setIsRequesting(false);
        return;
      }

      // Reveal the element FIRST, then attach. The <video> is always mounted,
      // but this ordering also guarantees it is visible before we judge frames.
      setIsActive(true);
      const videoEl = await waitForVideoElement();
      if (!mountedRef.current || token !== runTokenRef.current || !videoEl) {
        setIsRequesting(false);
        return;
      }

      // Attach AND start playback. Autoplay alone does not start a stream that
      // arrives after mount on iOS Safari, which left the preview black.
      await attachStreamToVideo(videoEl, result.stream);
      if (!mountedRef.current || token !== runTokenRef.current) {
        setIsRequesting(false);
        return;
      }
      setIsRequesting(false);

      // A granted stream is not a live preview. Report "passed" only once a
      // frame is actually delivered, and bound the wait so a stall is honest.
      const source = await verifyLiveFrames(videoEl, token);
      if (!mountedRef.current || token !== runTokenRef.current) return;

      if (source) {
        onResultUpdate?.(
          'passed',
          `Mirror preview is live${isMirrored ? ' and horizontally mirrored' : ''}. Frame delivery confirmed via ${source}. Preview confirms delivery only — not a full camera certification.`
        );
      } else {
        const msg =
          'The camera was granted and the preview started, but no video frame arrived within 12 seconds, so the mirror could not be confirmed. This is a playback problem, not a permission problem.';
        setErrorMsg(msg);
        onResultUpdate?.('inconclusive', msg);
      }
    } catch (err: unknown) {
      const error = err as Error;
      const stale = !sessionRef.current.reject(token);
      clearFrameWatch();
      setIsRequesting(false);
      if (stale || !mountedRef.current) return;
      setErrorMsg(error.message || 'Camera access denied or unavailable');
      onResultUpdate?.('failed', `${error.name}: ${error.message || 'Camera access denied or unavailable'}`);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    // Capture the refs up front: the cleanup runs after unmount and must not
    // read ref fields that React may have detached. Capturing the element here
    // is safe only because the <video> is now always mounted — effects run
    // after the first commit, so the ref is already populated.
    const session = sessionRef.current;
    const videoEl = videoRef.current;
    return () => {
      mountedRef.current = false;
      // Unmount: invalidate pending work, cancel the frame check, and release
      // every track. No setState — this must be safe after React has torn the
      // component down.
      clearFrameWatch();
      session.invalidate();
      session.releaseAll();
      if (videoEl) {
        videoEl.srcObject = null;
        try {
          videoEl.pause();
        } catch {
          // ignore
        }
      }
    };
  }, [clearFrameWatch]);

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
        {/* The <video> stays MOUNTED for the whole session. It used to be
            rendered only while active, so the ref was still null at the moment
            the stream needed attaching and the preview stayed black forever.
            Opacity (not display:none) keeps the element decoding. */}
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Live mirrored camera preview"
            className={`w-full max-h-[560px] object-cover transition-all duration-150 ${
              isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{
              transform: `${isMirrored ? 'scaleX(-1)' : 'scaleX(1)'} scale(${zoomLevel})`,
            }}
          />
        </div>
        {!isActive && (
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
              disabled={isRequesting}
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0D665F] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm"
            >
              {isRequesting ? 'Requesting…' : 'Enable Mirror'}
            </button>
          </div>
        )}

        {/* Floating overlay controls when active.
            Anchoring: `inset-x-3` sets both offsides, `w-fit` keeps the pill as
            narrow as its content, and `mx-auto` centres it — so the wrap width
            is the whole inner width of the preview instead of the 50% that
            `left-1/2 -translate-x-1/2` gave a shrink-to-fit box. On a phone the
            row therefore wraps (centred, two balanced rows) rather than
            overflowing the preview and being clipped; on wider screens the
            content fits one row and the desktop pill is unchanged. */}
        {isActive && (
          <div className="absolute inset-x-3 bottom-3 sm:bottom-4 mx-auto w-fit flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#111D30]/90 backdrop-blur-md border border-[#223043] text-white text-xs shadow-lg">
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className={`${CONTROL_BUTTON} bg-[#192332] hover:bg-[#223043] font-medium`}
              title="Flip Horizontal"
            >
              <FlipHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>{isMirrored ? 'Mirrored' : 'Natural'}</span>
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.25))}
              disabled={zoomLevel <= 1}
              className={`${CONTROL_BUTTON} sm:px-1.5 bg-[#192332] hover:bg-[#223043] disabled:opacity-40`}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="font-mono text-[11px] px-1">{zoomLevel.toFixed(1)}x</span>

            <button
              onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
              disabled={zoomLevel >= 3}
              className={`${CONTROL_BUTTON} sm:px-1.5 bg-[#192332] hover:bg-[#223043] disabled:opacity-40`}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={takeSnapshot}
              className={`${CONTROL_BUTTON} bg-[#0F766E] hover:bg-[#0D665F] font-semibold`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              Snapshot
            </button>

            <button
              onClick={stopStream}
              className={`${CONTROL_BUTTON} bg-red-600 hover:bg-red-700 font-semibold`}
            >
              Turn Off
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
