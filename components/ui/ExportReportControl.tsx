'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, FileText, X } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import { ToolDefinition } from '@/lib/tools/types';
import type { TestResultPayload } from '@/components/TestResultBanner';
import {
  buildCsv,
  buildExportReport,
  buildPrintReport,
  canExportCsv,
  csvFilename,
  previewMetrics,
  ExportReportData,
} from '@/lib/testing/exportReport';
import { buildPdf, pdfBlob, pdfFilename, reportLinesFromText } from '@/lib/testing/pdf';
import { deliverOnce } from '@/lib/testing/deliver';
import { SITE_URL } from '@/lib/site';

interface ExportReportControlProps {
  tool: ToolDefinition;
  /** The completed verdict currently shown in the card's banner. */
  result: TestResultPayload;
}

/**
 * Hand a generated file to the user without leaving the page.
 *
 * Exactly ONE file is produced per tap. See lib/testing/deliver.ts for the
 * full rationale — in short, the Web Share `title` member used to produce a
 * stray `text.txt` containing only the filename, and a share failure could
 * also trigger a second download. The delivery decision itself lives in a
 * tested module; this function only supplies the real browser surface.
 *
 * Neither path navigates the current tab: losing the result the user came to
 * export was the original defect.
 */
async function deliverFile(blob: Blob, filename: string): Promise<'share' | 'download'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const result = await deliverOnce(blob, filename, {
    share: typeof nav.share === 'function' ? nav.share.bind(nav) : undefined,
    canShare: typeof nav.canShare === 'function' ? nav.canShare.bind(nav) : undefined,
    createObjectURL: (b) => URL.createObjectURL(b),
    startDownload: (url, name) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  });
  return result.method;
}

/**
 * Phase 2 — reusable "Export report" control for a completed test verdict.
 *
 * Everything happens in the browser: the print report opens a scoped print
 * window the user saves as PDF, and the CSV download is a local Blob. No
 * fetch, no upload, no external service.
 *
 * Preview-first: the dialog shows EXACTLY what would be exported before any
 * format is produced. Device-label values are excluded by default and are
 * included only through an explicit opt-in checkbox. Recordings, video, IP
 * addresses, pressed keys, and clipboard contents are never part of any
 * export (the builders strip/deny them — see lib/testing/exportReport.ts).
 */
export function ExportReportControl({ tool, result }: ExportReportControlProps) {
  const [open, setOpen] = useState(false);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  /** Observation time captured when the dialog opens (event-time, not render-time). */
  const [observedAt, setObservedAt] = useState<number | null>(null);
  /**
   * Set when the browser blocked the print window AND the same-tab print
   * fallback could not run either. The dialog then names the limitation
   * plainly and offers the text report — a .txt file is never called a PDF.
   */
  const [txtFallback, setTxtFallback] = useState(false);
  /** How the last PDF was delivered: system share sheet, or a download. */
  const [delivery, setDelivery] = useState<'share' | 'download' | null>(null);
  /** Set when PDF generation itself failed; the text report remains offered. */
  const [pdfError, setPdfError] = useState(false);

  const data: ExportReportData = useMemo(
    () =>
      buildExportReport(tool, result, observedAt ?? result.observedAt ?? 0, {
        includeSensitive,
      }),
    [tool, result, includeSensitive, observedAt]
  );

  const preview = useMemo(() => previewMetrics(data, { includeSensitive }), [data, includeSensitive]);
  const csvAvailable = useMemo(() => canExportCsv(data), [data]);

  // Escape closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const reportText = useCallback(() => {
    // Prefer the origin the test actually ran on: it is always the public
    // page the user is looking at, so a production report can never claim a
    // localhost URL. SITE_URL (a build-time constant that falls back to
    // http://localhost:3000 when NEXT_PUBLIC_SITE_URL is unset) is only the
    // fallback for non-browser callers.
    const origin =
      typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
        ? window.location.origin
        : SITE_URL;
    return buildPrintReport(data, origin || undefined);
  }, [data]);

  const downloadTextReport = useCallback(() => {
    // Honest last resort: a TEXT report. It is never described as a PDF.
    const blob = new Blob([reportText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devicetry-${data.toolSlug}-report.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setTxtFallback(true);
  }, [data.toolSlug, reportText]);

  /**
   * Produce a REAL PDF in memory and hand it to the user. No pop-up, no
   * tab navigation, no print() — so it behaves identically on iOS Safari,
   * Android Chrome, and desktop, and the result stays on screen.
   *
   * The PDF is built from the same previewed data model the dialog shows,
   * so a device label appears only if the user opted in.
   */
  const downloadPdf = useCallback(async () => {
    setPdfError(false);
    setDelivery(null);
    try {
      const text = reportText();
      const model = reportLinesFromText(text);
      const bytes = buildPdf({ title: model.title, lines: model.lines });
      const blob = pdfBlob(bytes, model.title);
      const filename = pdfFilename(data.toolSlug, data.observedAt);
      const how = await deliverFile(blob, filename);
      setDelivery(how);
      setTxtFallback(false);
    } catch {
      // A failed PDF must say so plainly and offer the text report, rather
      // than silently doing nothing.
      setPdfError(true);
    }
  }, [data.toolSlug, data.observedAt, reportText]);

  const downloadCsv = useCallback(() => {
    const csv = buildCsv(data);
    if (!csv) return; // No tabular measurements — the button is hidden anyway.
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename(data);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [data]);

  const anyMetrics = preview.length > 0;
  const excludedCount = preview.filter((m) => !m.included).length;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Event-time capture: the observation timestamp is the verdict's
          // own stamp; only a legacy payload without one falls back to the
          // moment the user opened the export dialog.
          setObservedAt(result.observedAt ?? Date.now());
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors cursor-pointer no-print"
      >
        <FileDown className="w-3.5 h-3.5" />
        Export report
      </button>

      {open && (
        <div
          className="no-print fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0B111A]/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Export report"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] shadow-xl overflow-hidden">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full text-[#5F6B7A] dark:text-[#9AA6B8] hover:bg-[#F1F4F7] dark:hover:bg-[#192332] transition-colors cursor-pointer"
              aria-label="Close export dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-5">
              <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">
                Export report — {data.toolTitle}
              </h3>
              <p className="mt-1 text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
                Generated locally in your browser — nothing is uploaded. Preview what will be
                included before exporting.
              </p>

              {/* What's always included */}
              <div className="mt-4 p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-xs text-[#142033] dark:text-[#E9EEF4] space-y-1">
                <p><span className="font-semibold">Test:</span> {data.toolTitle}</p>
                <p><span className="font-semibold">Observed:</span> {new Date(data.observedAt).toLocaleString()}</p>
                <p><span className="font-semibold">Status:</span> {data.status}</p>
                <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">{data.details || 'No summary sentence recorded.'}</p>
              </div>

              {/* Measurements preview with per-field inclusion state */}
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8]">
                  Measurements
                </p>
                {anyMetrics ? (
                  <ul className="mt-1.5 space-y-1">
                    {preview.map((m) => (
                      <li key={m.key} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-[#142033] dark:text-[#E9EEF4] font-medium">{m.key}</span>
                        <span className={m.included ? 'text-[#0F766E] dark:text-[#14B8A6] font-mono-num' : 'text-[#8996A6] text-right'}>
                          {m.display}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-xs text-[#8996A6]">
                    No measurements were captured for this run — only the summary and status will be exported.
                  </p>
                )}
                {excludedCount > 0 && (
                  <p className="mt-1.5 text-[11px] text-[#8996A6] leading-relaxed">
                    {excludedCount} device-label value{excludedCount > 1 ? 's are' : ' is'} excluded by default.
                    Recordings, video, IP addresses, pressed keys, and clipboard contents are never exported.
                  </p>
                )}
              </div>

              {/* Explicit opt-in for sensitive (device-label) values */}
              {preview.some((m) => m.sensitive) && (
                <label className="mt-3 flex items-start gap-2 text-xs text-[#142033] dark:text-[#E9EEF4] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSensitive}
                    onChange={(e) => setIncludeSensitive(e.target.checked)}
                    className="mt-0.5 accent-[#0F766E]"
                  />
                  <span>
                    Include device-label values (e.g. your camera or microphone&apos;s name).
                    Left unchecked, they stay out of the export.
                  </span>
                </label>
              )}

              {/* Export actions */}
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={downloadPdf}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white dark:text-[#0B111A] transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Download PDF report
                </button>
                {delivery === 'share' && (
                  <p role="status" className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
                    A real PDF was created and handed to your device&apos;s share sheet — choose
                    &ldquo;Save to Files&rdquo; or a destination there. Your test result is still on
                    this page.
                  </p>
                )}
                {delivery === 'download' && !pdfError && (
                  <p role="status" className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
                    The PDF was created in your browser and sent to your downloads. Nothing was
                    uploaded, and this page did not navigate away.
                  </p>
                )}
                {pdfError && (
                  <div role="status" className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed space-y-1.5">
                    <p>The PDF could not be created on this device. No file was produced.</p>
                    <button
                      type="button"
                      onClick={downloadTextReport}
                      className="underline underline-offset-2 cursor-pointer"
                    >
                      Download a plain-text (.txt) report instead
                    </button>
                    <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">
                      The .txt file is not a PDF, but it contains the same report text.
                    </p>
                  </div>
                )}
                {txtFallback && !pdfError && (
                  <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    A plain-text (.txt) copy of this report was downloaded. It is not a PDF — use
                    the PDF button above for a real PDF.
                  </p>
                )}
                {csvAvailable && (
                  <button
                    type="button"
                    onClick={downloadCsv}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] transition-colors cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    Download CSV (measurements)
                  </button>
                )}
                {!csvAvailable && (
                  <p className="text-[11px] text-[#8996A6] leading-relaxed">
                    No CSV for this result: it has no tabular measurements, and DeviceTry does not
                    create spreadsheets without real values.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ExportReportControl;
