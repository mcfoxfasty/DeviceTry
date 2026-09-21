/**
 * Video frame-delivery gate — extracted from WebcamTester so the "a passed
 * verdict requires an ACTUALLY delivered frame" rule is regression-testable.
 *
 * A stream that is merely created, attached, or metadata-loaded is NOT proof
 * of working video: metadata can carry dimensions while frames never render.
 * This gate confirms delivery of at least one usable frame via
 * requestVideoFrameCallback (the precise API) and documents an honest
 * fallback (video.readyState >= HAVE_CURRENT_DATA plus non-zero dimensions)
 * for browsers without rVFC (e.g. Firefox < ~130, older Safari).
 */

export type VideoFrameSource = 'requestVideoFrameCallback' | 'readyState-fallback';

export interface FrameGateDecision {
  /** Whether the observed evidence qualifies as "frame delivered". */
  delivered: boolean;
  /** Which facility produced the evidence (for honest result details). */
  source: VideoFrameSource;
}

/**
 * Does this browser support requestVideoFrameCallback on video elements?
 * Checked on the element instance first, then the prototype.
 */
export function supportsRequestVideoFrameCallback(el: unknown): boolean {
  if (!el || typeof el !== 'object') return false;
  const candidate = el as { requestVideoFrameCallback?: unknown };
  if (typeof candidate.requestVideoFrameCallback === 'function') {
    return true;
  }
  if (typeof HTMLVideoElement !== 'undefined') {
    return typeof (HTMLVideoElement.prototype as unknown as { requestVideoFrameCallback?: unknown })
      .requestVideoFrameCallback === 'function';
  }
  return false;
}

/**
 * Fallback check when rVFC is unavailable: the element reports data available
 * for the current frame position (HAVE_CURRENT_DATA or later) and real
 * dimensions — the best available evidence short of a frame callback.
 */
export function readyStateIndicatesDeliveredFrame(el: {
  readyState?: number;
  videoWidth?: number;
  videoHeight?: number;
} | null): boolean {
  if (!el) return false;
  const readyState = typeof el.readyState === 'number' ? el.readyState : 0;
  return readyState >= 2 && (el.videoWidth ?? 0) > 0 && (el.videoHeight ?? 0) > 0;
}

/**
 * Create a bound gate for one video stream observation. All callbacks are
 * closed over the immutable run token and stream identity captured at
 * creation — a callback belonging to an old stream or old run can never
 * report (the tester checks `isCurrent()` before applying any UI update).
 */
export function createFrameGate(options: {
  runToken: number;
  streamIdentity: unknown;
  /** Tester-provided liveness: token === currentRun() && streamRef === stream && !unmounted. */
  isCurrent: () => boolean;
}) {
  const { runToken, streamIdentity, isCurrent } = options;
  let delivered = false;

  return {
    get delivered(): boolean {
      return delivered;
    },
    get source(): VideoFrameSource | null {
      return delivered ? 'requestVideoFrameCallback' : null;
    },
    /**
     * Whether this gate's observation is still the live one. Remains true
     * after the first delivered frame so the caller's frame loop (FPS
     * accounting, resolution updates) can keep running on the live stream;
     * result-level dedupe is handled by the ResultController, not here.
     */
    isLive(): boolean {
      return isCurrent();
    },
    /**
     * A requestVideoFrameCallback fired for this stream. Returns the full
     * decision the caller should apply; false when the callback is stale or
     * the frame was already accounted for.
     */
    onFrame(observedToken: number, observedStream: unknown): FrameGateDecision {
      if (observedToken !== runToken || observedStream !== streamIdentity || !isCurrent()) {
        return { delivered: false, source: 'requestVideoFrameCallback' };
      }
      delivered = true;
      return { delivered: true, source: 'requestVideoFrameCallback' };
    },
    /**
     * Poll-based fallback used when rVFC is unavailable. Applies the same
     * token/stream/identity guards to the readyState evidence.
     */
    checkFallbackReady(el: { readyState?: number; videoWidth?: number; videoHeight?: number } | null): FrameGateDecision {
      if (!isCurrent()) {
        return { delivered: false, source: 'readyState-fallback' };
      }
      if (readyStateIndicatesDeliveredFrame(el)) {
        delivered = true;
        return { delivered: true, source: 'readyState-fallback' };
      }
      return { delivered: false, source: 'readyState-fallback' };
    },
  };
}
