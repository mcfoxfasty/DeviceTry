/**
 * Camera stream acquisition guard — extracted from WebcamTester so the
 * stale-request lifecycle can be regression-tested without a DOM.
 *
 * One session guards one tester instance. Every acquisition attempt binds to
 * the caller's immutable run token (captured when the attempt BEGINS — never
 * re-read inside a later promise resolution):
 *
 * - `begin(token)` marks the new attempt as the only live one. Any older
 *   attempt becomes stale and its eventual stream must be released.
 * - `resolve(token, stream)` adopts the stream only if `token` is still the
 *   live attempt. A stale stream is torn down (every track stopped) and the
 *   caller must report nothing.
 * - `releaseAll()` tears down the adopted stream. It is pure resource
 *   teardown: it does NOT change which attempt is live.
 */
export interface CameraStreamHandle {
  getTracks(): Array<{ stop(): void }>;
}

export interface CameraSessionResult<T> {
  /** false when the attempt was superseded/unmounted and must report nothing. */
  live: boolean;
  /** The adopted stream; null when stale (the stale stream has been stopped). */
  stream: T | null;
}

export class CameraSession<T extends CameraStreamHandle> {
  private liveToken: number | null = null;
  private adoptedStream: T | null = null;

  /**
   * Begin a new acquisition attempt for the given (freshly minted) run token.
   * Any previously adopted stream is released and older attempts go stale.
   * Returns false if the session was already superseded by a NEWER token
   * (out-of-order begin) — the caller must abandon immediately.
   */
  begin(token: number): boolean {
    if (this.liveToken !== null && token < this.liveToken) {
      return false; // a newer attempt already began; this one is out of order
    }
    this.releaseAdopted();
    this.liveToken = token;
    return true;
  }

  /**
   * A getUserMedia promise resolved. Adopt only when `token` is still the
   * live attempt; otherwise stop every returned track immediately and report
   * nothing. Never reads current state to "adopt the latest" — the token is
   * immutable from attempt start.
   */
  resolve(token: number, stream: T): CameraSessionResult<T> {
    if (token !== this.liveToken) {
      this.stopAllTracks(stream);
      return { live: false, stream: null };
    }
    this.adoptedStream = stream;
    return { live: true, stream };
  }

  /**
   * The promise rejected. Rejections only matter while the attempt is live.
   */
  reject(token: number): boolean {
    return token === this.liveToken;
  }

  /**
   * Pure resource teardown of the adopted stream. Does NOT change the live
   * token: Stop-as-cleanup releases hardware without invalidating lifecycle,
   * while explicit lifecycle resets go through the tester's startRun/invalidate.
   */
  releaseAll(): void {
    this.releaseAdopted();
  }

  /** Invalidate the live attempt (unmount/reset): pending resolutions go stale. */
  invalidate(): void {
    this.liveToken = null;
  }

  get hasLiveAttempt(): boolean {
    return this.liveToken !== null;
  }

  private releaseAdopted(): void {
    if (this.adoptedStream) {
      this.stopAllTracks(this.adoptedStream);
      this.adoptedStream = null;
    }
  }

  private stopAllTracks(stream: T): void {
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore individual track failures
        }
      });
    } catch {
      // ignore
    }
  }
}
