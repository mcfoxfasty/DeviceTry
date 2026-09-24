/**
 * One-file file delivery for the export flow.
 *
 * THE BUG THIS FIXES: one tap on "Download PDF report" produced TWO files —
 * a valid PDF and a `text.txt` containing nothing but the PDF's filename.
 *
 * The cause was the Web Share `title` member, not the report fallback (the
 * fallback writes `devicetry-<slug>-report.txt` with the full report body).
 * Per the Web Share spec, `title` is a *suggested title for the shared
 * item*: share targets use it as an email subject, a note title, or a
 * message body. A target that cannot carry the attached file falls back to
 * sharing `title` as plain text, and the OS saves that as `text.txt`. The
 * File object already carries the correct filename, so `title` contributed
 * nothing except a junk duplicate.
 *
 * The second defect was in the error path: a share failure other than
 * `AbortError` fell through to the download fallback. If the share had
 * already handed the file to the OS, the user then got a second copy too.
 *
 * Both are fixed structurally here: `title` is never sent, and the two
 * branches are mutually exclusive so one call yields at most one file.
 *
 * The browser surface is injected so this is testable without a DOM.
 */

/** How a file was handed to the user. */
export type DeliveryMethod = 'share' | 'download';

/** The subset of the browser this module touches. */
export interface DeliveryEnvironment {
  /** Web Share `share`, if the platform has it. */
  share?: (data: ShareData) => Promise<void>;
  /** Web Share `canShare`, used to confirm files are actually shareable. */
  canShare?: (data: ShareData) => boolean;
  /** Creates an object URL for the download path. */
  createObjectURL: (blob: Blob) => string;
  /** Triggers the download. Implementations own the anchor's lifetime. */
  startDownload: (url: string, filename: string) => void;
}

export interface DeliveryResult {
  method: DeliveryMethod;
  /** True when a share was attempted, whatever its outcome. */
  shareAttempted: boolean;
}

/**
 * Deliver exactly one file.
 *
 * Never both: if the share path is taken, the download path is not run, even
 * when the share rejects. A rejected share may still have reached the OS, so
 * following it with a download is precisely how a duplicate appeared before.
 */
export async function deliverOnce(
  blob: Blob,
  filename: string,
  env: DeliveryEnvironment
): Promise<DeliveryResult> {
  if (typeof env.share === 'function' && typeof env.canShare === 'function') {
    let shareable = false;
    try {
      // Probe first: some platforms expose `share` but cannot carry files.
      shareable = env.canShare({ files: [new File([blob], filename, { type: blob.type })] });
    } catch {
      shareable = false;
    }

    if (shareable) {
      try {
        // Files ONLY. No `title`, so no share target can fall back to
        // serialising the filename as a text.txt body.
        await env.share({ files: [new File([blob], filename, { type: blob.type })] });
      } catch {
        // Cancellation or platform failure: terminal for this action. The
        // download fallback is intentionally NOT run — the share may already
        // have delivered the file, and a second delivery is the bug.
      }
      return { method: 'share', shareAttempted: true };
    }
  }

  const url = env.createObjectURL(blob);
  env.startDownload(url, filename);
  return { method: 'download', shareAttempted: false };
}
