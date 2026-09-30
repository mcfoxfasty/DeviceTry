/**
 * Codec and container capability probe.
 *
 * HONESTY CONTRACT (the old implementation reported `passed` unconditionally,
 * including for a run in which every single probe returned false):
 *  - The probe reports what the browser SAYS it can handle:
 *    `MediaRecorder.isTypeSupported(mime)` and
 *    `HTMLMediaElement.canPlayType(mime)`. Both are capability statements
 *    from the browser's own tables. Neither one records, decodes, negotiates
 *    or accelerates anything, and no row here is evidence that a call will
 *    work, that a codec is hardware-accelerated, or that WebRTC will pick it.
 *  - "Completed the probe" and "supports these formats" are two different
 *    facts and are reported separately.
 *  - A missing OPTIONAL format is not a fault: browsers ship different codec
 *    sets (notably Chromium builds without proprietary codecs).
 *  - Four failure modes are kept apart and never merged into "no":
 *      `unavailable` — the API that answers this question does not exist,
 *      `error`       — the API exists but the probe threw,
 *      `maybe`       — canPlayType returned "maybe" (uncertain, not negative),
 *      `unsupported` — the API answered, and the answer was a negative.
 */

export type CodecResult = 'supported' | 'maybe' | 'unsupported' | 'unavailable' | 'error';

export type CodecKind = 'audio' | 'video' | 'recording';

export interface CodecProbeSpec {
  name: string;
  mime: string;
  kind: CodecKind;
}

export interface CodecRow extends CodecProbeSpec {
  result: CodecResult;
  /** The literal value the browser returned, shown verbatim for auditability. */
  raw: string;
  /** The API that produced the answer, or why none could. */
  method: string;
}

/** Recording containers reported through MediaRecorder.isTypeSupported. */
export const RECORDING_SPECS: readonly CodecProbeSpec[] = [
  { name: 'WebM (VP8 + Opus)', mime: 'video/webm;codecs=vp8,opus', kind: 'recording' },
  { name: 'WebM (VP9 + Opus)', mime: 'video/webm;codecs=vp9,opus', kind: 'recording' },
  { name: 'WebM (AV1)', mime: 'video/webm;codecs=av01', kind: 'recording' },
  { name: 'MP4 (H.264 + AAC)', mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', kind: 'recording' },
  { name: 'Audio-only WebM (Opus)', mime: 'audio/webm;codecs=opus', kind: 'recording' },
  { name: 'Audio-only Ogg', mime: 'audio/ogg;codecs=opus', kind: 'recording' },
] as const;

/** Playback rows, each bound to the media element that matches its kind. */
export const PLAYBACK_SPECS: readonly CodecProbeSpec[] = [
  { name: 'H.264 (AVC) MP4', mime: 'video/mp4; codecs="avc1.42E01E"', kind: 'video' },
  { name: 'H.265 / HEVC', mime: 'video/mp4; codecs="hvc1.1.6.L93.B0"', kind: 'video' },
  { name: 'VP9 WebM', mime: 'video/webm; codecs="vp9"', kind: 'video' },
  { name: 'AV1 MP4', mime: 'video/mp4; codecs="av01.0.05M.08"', kind: 'video' },
  { name: 'AAC audio', mime: 'audio/mp4; codecs="mp4a.40.2"', kind: 'audio' },
  { name: 'MP3', mime: 'audio/mpeg', kind: 'audio' },
  { name: 'FLAC', mime: 'audio/flac', kind: 'audio' },
  { name: 'Opus in Ogg', mime: 'audio/ogg; codecs="opus"', kind: 'audio' },
] as const;

export interface CodecProbeEnvironment {
  /** MediaRecorder constructor, or undefined when the API is absent. */
  recorder?: { isTypeSupported(mime: string): boolean } | undefined;
  /** Element used for video/* playback rows. */
  videoElement?: { canPlayType(mime: string): string } | null;
  /** Element used for audio/* playback rows. */
  audioElement?: { canPlayType(mime: string): string } | null;
}

export interface CodecProbeReport {
  rows: CodecRow[];
  /** The probe ran to completion. Says nothing about the answers. */
  probeCompleted: boolean;
  supportedCount: number;
  maybeCount: number;
  unsupportedCount: number;
  unavailableCount: number;
  errorCount: number;
  recorderAvailable: boolean;
  canPlayTypeAvailable: boolean;
}

/**
 * Run every probe. Each API is probed independently, so a missing
 * MediaRecorder cannot blank the playback table and vice versa.
 */
export function probeCodecSupport(env: CodecProbeEnvironment): CodecProbeReport {
  const rows: CodecRow[] = [];

  const recorderAvailable = typeof env.recorder?.isTypeSupported === 'function';
  for (const spec of RECORDING_SPECS) {
    if (!recorderAvailable) {
      rows.push({ ...spec, result: 'unavailable', raw: 'n/a', method: 'MediaRecorder.isTypeSupported() — API not present' });
      continue;
    }
    try {
      const answer = env.recorder!.isTypeSupported(spec.mime);
      rows.push({
        ...spec,
        result: answer ? 'supported' : 'unsupported',
        raw: String(answer),
        method: 'MediaRecorder.isTypeSupported() — reported capability, not a recording',
      });
    } catch (err) {
      rows.push({
        ...spec,
        result: 'error',
        raw: 'threw',
        method: `MediaRecorder.isTypeSupported() threw: ${message(err)}`,
      });
    }
  }

  // Every playback row is asked of the element that matches its own kind:
  // an audio/* mime string is never handed to a <video> element.
  for (const spec of PLAYBACK_SPECS) {
    const element = spec.kind === 'audio' ? env.audioElement : env.videoElement;
    const elementName = spec.kind === 'audio' ? 'audio' : 'video';
    if (!element || typeof element.canPlayType !== 'function') {
      rows.push({
        ...spec,
        result: 'unavailable',
        raw: 'n/a',
        method: `HTML${elementName}Element.canPlayType() — no <${elementName}> element available`,
      });
      continue;
    }
    try {
      const verdict = String(element.canPlayType(spec.mime) ?? '');
      const result: CodecResult =
        verdict === 'probably' ? 'supported' : verdict === 'maybe' ? 'maybe' : 'unsupported';
      rows.push({
        ...spec,
        result,
        raw: verdict === '' ? '(empty string)' : verdict,
        method: `<${elementName}>.canPlayType() — reported capability, not a decode`,
      });
    } catch (err) {
      rows.push({
        ...spec,
        result: 'error',
        raw: 'threw',
        method: `canPlayType() threw: ${message(err)}`,
      });
    }
  }

  const count = (result: CodecResult) => rows.filter((row) => row.result === result).length;
  return {
    rows,
    probeCompleted: true,
    supportedCount: count('supported'),
    maybeCount: count('maybe'),
    unsupportedCount: count('unsupported'),
    unavailableCount: count('unavailable'),
    errorCount: count('error'),
    recorderAvailable,
    canPlayTypeAvailable: rows.some((row) => row.method.includes('canPlayType() —') && row.result !== 'unavailable'),
  };
}

function message(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

export interface CodecSummary {
  status: 'unsupported' | 'inconclusive' | 'measured';
  details: string;
  /** Reusable metrics: counts only, so the shared export never carries payloads. */
  metrics: Record<string, number | boolean>;
}

/**
 * Verdict for a completed probe. There is no "passed" case: every answer is a
 * browser capability claim, so the strongest possible honest verdict is
 * "measured" (completed, neutral). Zero positive answers is reported as
 * inconclusive with the reason, never dressed up as success.
 */
export function summarizeCodecProbe(report: CodecProbeReport): CodecSummary {
  const { rows } = report;
  const total = rows.length;

  if (!report.recorderAvailable && !report.canPlayTypeAvailable) {
    return {
      status: 'unsupported',
      details:
        'Neither MediaRecorder.isTypeSupported() nor HTMLMediaElement.canPlayType() is available here, so no codec ' +
        'information could be gathered. This says nothing about what the browser can actually record or play.',
      metrics: { formatsProbed: total, supported: 0, apiAvailable: 0 },
    };
  }

  const metrics: Record<string, number | boolean> = {
    formatsProbed: total,
    supported: report.supportedCount,
    maybe: report.maybeCount,
    unsupported: report.unsupportedCount,
    unavailable: report.unavailableCount,
    probeErrors: report.errorCount,
  };

  const unknownCount = report.unavailableCount + report.errorCount;
  const coverage =
    unknownCount > 0
      ? ` ${unknownCount} of ${total} rows could not be answered because the API was unavailable or threw.`
      : '';

  if (report.supportedCount === 0) {
    const uncertain = report.maybeCount > 0 ? ` ${report.maybeCount} row(s) answered "maybe", which is uncertain rather than negative.` : '';
    return {
      status: 'inconclusive',
      details:
        `The probe completed, but no format came back positively supported (0/${total}).${uncertain}${coverage} ` +
        'That is a fact about these capability tables, not a fault in the browser: an optional codec missing here does ' +
        'not stop this site\'s own recorder, which encodes WAV itself.',
      metrics,
    };
  }

  return {
    status: 'measured',
    details:
      `The probe completed. ${report.supportedCount} of ${total} formats are reported as supported` +
      (report.maybeCount > 0 ? `, ${report.maybeCount} as "maybe"` : '') +
      `.${coverage} These are the browser's own capability answers — not evidence of recording, decoding, hardware ` +
      'acceleration, or a working WebRTC call.',
    metrics,
  };
}
