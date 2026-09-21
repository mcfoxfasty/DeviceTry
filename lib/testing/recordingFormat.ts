/**
 * MediaRecorder format selection and download-extension mapping — extracted
 * from VoiceRecorderTester so the format logic is regression-testable
 * without a browser.
 *
 * Rules enforced here:
 * - Never force audio/webm onto a recording created in another format.
 * - Preference order is resolved through MediaRecorder.isTypeSupported when
 *   available; without it (very old browsers) the caller decides honestly.
 * - The final blob type comes from the ACTUAL recorder.mimeType, not the
 *   requested one.
 * - Extension is derived from the actual MIME type, including the previously
 *   wrong Ogg mapping (audio/ogg → .ogg, not .webm).
 */

export interface MediaRecorderSupport {
  isTypeSupported(mimeType: string): boolean;
}

/**
 * Preference order across the formats the current implementation supports:
 * Opus/WebM (Chromium, Firefox), MP4/AAC (Safari), Ogg/Opus (Firefox alt),
 * then bare WebM and MP4 containers.
 */
export const RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

export const FALLBACK_MIME = 'audio/webm';

/** True when the MediaRecorder API exists at all in this runtime. */
export function isMediaRecorderAvailable(recorderCtor?: unknown): boolean {
  return typeof recorderCtor === 'function';
}

/**
 * Pick the first container the browser records natively. Returns null when
 * MediaRecorder is unavailable or support cannot be probed — callers must
 * surface an honest unsupported state instead of guessing audio/webm.
 */
export function selectRecordingMimeType(support: MediaRecorderSupport | null): string | null {
  if (!support || typeof support.isTypeSupported !== 'function') {
    return null;
  }
  for (const candidate of RECORDING_MIME_CANDIDATES) {
    try {
      if (support.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // continue probing remaining candidates
    }
  }
  return null;
}

/** Extract the bare container name (webm, mp4, ogg, x-wav) from a full MIME type. */
export function mimeContainer(mimeType: string | undefined | null): string | null {
  if (!mimeType) return null;
  const match = mimeType.toLowerCase().match(/^audio\/([a-z0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Map the ACTUAL recorded MIME type to an accurate download extension.
 * Throws nothing; unknown containers fall back to null so the caller can use
 * a generic name rather than a wrong one.
 */
export function extensionForMimeType(mimeType: string | undefined | null): string | null {
  const container = mimeContainer(mimeType);
  switch (container) {
    case 'webm':
      return 'webm';
    case 'mp4':
    case 'm4a':
      return 'm4a' === container ? 'm4a' : 'mp4';
    case 'ogg':
      return 'ogg';
    case 'wav':
    case 'wave':
    case 'x-wav':
      return 'wav';
    case 'mpeg':
    case 'mp3':
      return 'mp3';
    case 'aac':
      return 'aac';
    default:
      return null;
  }
}

/**
 * The blob type to stamp on the final recording: the ACTUAL recorder MIME
 * when the browser reported one, otherwise the requested type.
 */
export function actualBlobMimeType(recorderMimeType: string | undefined | null, requested: string): string {
  if (recorderMimeType && recorderMimeType.trim() !== '') {
    return recorderMimeType;
  }
  return requested;
}
