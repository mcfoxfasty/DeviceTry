/**
 * Voice-recording session lifecycle — extracted from VoiceRecorderTester so
 * the stale-request/cleanup semantics are regression-testable without a DOM.
 *
 * One RecordingSession guards one tester instance. It enforces:
 * - Concurrent-start prevention: a start while a request is in flight (or a
 *   recorder is active) is refused instead of stacking MediaRecorder
 *   instances or double-requesting the microphone.
 * - Immutable run tokens captured at operation start (owner-supplied, the
 *   same single-token model as ResultController/CameraSession): a
 *   getUserMedia resolving after cancel/replace/unmount has every returned
 *   track stopped immediately and reports nothing.
 * - Pure resource teardown (releaseResources) separable from lifecycle
 *   invalidation (invalidate), so an unmount never erases a legitimately
 *   completed guided result.
 * - No success verdict without recorded data: finishRecording returns null
 *   unless the recorder delivered at least one non-empty chunk.
 */

export interface MediaTrackLike {
  stop(): void;
}

export interface MediaStreamLike {
  getTracks(): MediaTrackLike[];
}

export interface RecorderLike {
  state: string;
  stop(): void;
}

export interface RecorderFactoryRequest {
  stream: MediaStreamLike;
  mimeType: string | null;
}

/** A finished recording, or null when no usable audio data was captured. */
export interface FinishedRecording {
  /** Actual MIME of the produced blob (recorder MIME or requested). */
  mimeType: string;
  chunkCount: number;
}

export class RecordingSession {
  private liveToken: number | null = null;
  private pending = false;
  private activeRecorder: RecorderLike | null = null;

  /** True while a getUserMedia request is awaiting resolution. */
  get isPending(): boolean {
    return this.pending;
  }

  get hasActiveRecorder(): boolean {
    return this.activeRecorder !== null;
  }

  get activeRecorderState(): string | null {
    return this.activeRecorder?.state ?? null;
  }

  /**
   * Request to begin a recording attempt bound to `token`.
   * Refused when a request is already pending or a recorder is active —
   * the caller's Start button is disabled in those states anyway; this is
   * the hard backstop against concurrent recorder instances.
   */
  begin(token: number): boolean {
    if (this.pending || this.activeRecorder) {
      return false;
    }
    this.liveToken = token;
    this.pending = true;
    return true;
  }

  /**
   * The getUserMedia promise resolved with `stream`. Returns the stream only
   * when the token still identifies the live attempt; otherwise every
   * returned track is stopped immediately and null is returned.
   */
  adoptStream(token: number, stream: MediaStreamLike): MediaStreamLike | null {
    this.pending = false;
    if (token !== this.liveToken) {
      stopAllTracks(stream);
      return null;
    }
    return stream;
  }

  /**
   * Register the newly created recorder for the live attempt. Returns false
   * when the attempt went stale in the meantime (caller must discard it) or
   * when a recorder is already active — the hard backstop against stacking
   * repeated MediaRecorder instances on one session.
   */
  attachRecorder(token: number, recorder: RecorderLike): boolean {
    if (this.activeRecorder) {
      return false;
    }
    if (token !== this.liveToken) {
      return false;
    }
    this.activeRecorder = recorder;
    return true;
  }

  /**
   * The recorder finished. Returns the recording summary only when real
   * audio data exists (chunkCount > 0) — "no data" is never a pass.
   */
  finishRecording(token: number, chunkCount: number): FinishedRecording | null {
    this.activeRecorder = null;
    if (token !== this.liveToken) {
      return null;
    }
    if (chunkCount <= 0) {
      return null;
    }
    return { mimeType: '', chunkCount };
  }

  /**
   * Explicit cancel/stop: invalidates the attempt (late getUserMedia
   * resolutions stop their tracks and report nothing) and detaches the
   * recorder callbacks binding via the token check in finishRecording.
   */
  cancel(): void {
    this.liveToken = null;
    this.pending = false;
    this.activeRecorder = null;
  }

  /**
   * Pure teardown (unmount): invalidate pending work AND stop the caller's
   * recorded resource references. Detaching recorder callbacks = nulling the
   * recorder reference, so no late onstop/ondataavailable can mutate UI.
   */
  releaseResources(resources: {
    stream: MediaStreamLike | null;
    recorder: RecorderLike | null;
  }): void {
    this.cancel();
    if (resources.recorder) {
      try {
        if (resources.recorder.state !== 'inactive') {
          resources.recorder.stop();
        }
      } catch {
        // recorder already inactive — ignore
      }
    }
    if (resources.stream) {
      stopAllTracks(resources.stream);
    }
  }
}

function stopAllTracks(stream: MediaStreamLike): void {
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // individual track stop failures are non-fatal
      }
    });
  } catch {
    // ignore
  }
}
