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
import { SITE_URL } from '@/lib/site';

interface ExportReportControlProps {
  tool: ToolDefinition;
  /** The completed verdict currently shown in the card's banner. */
  result: TestResultPayload;
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
   * Set when the browser blocked the print window and a plain-text report
   * was downloaded instead. The dialog then says so plainly — a .txt file
   * is NOT a PDF, and the user must not be told otherwise.
   */
  const [txtFallback, setTxtFallback] = useState(false);

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

  const openPrintWindow = useCallback(() => {
    // Prefer the origin the test actually ran on: it is always the public
    // page the user is looking at, so a production report can never claim a
    // localhost URL. SITE_URL (a build-time constant that falls back to
    // http://localhost:3000 when NEXT_PUBLIC_SITE_URL is unset) is only the
    // fallback for non-browser callers.
    const origin =
      typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
        ? window.location.origin
        : SITE_URL;
    const report = buildPrintReport(data, origin || undefined);
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      // Popup blocked (common on iOS Safari): a plain-text report is
      // downloaded instead. This is a TEXT file, not a PDF — the dialog
      // states that explicitly rather than implying a PDF was produced.
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devicetry-${data.toolSlug}-report.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setTxtFallback(true);
      return;
    }
    setTxtFallback(false);
    win.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>' +
        'DeviceTry — Local Test Report</title>' +
        '<style>body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
        'font-size:13px;line-height:1.55;margin:2rem;white-space:pre-wrap;color:#111;}</style>' +
        '</head><body></body></html>'
    );
    win.document.body.textContent = report;
    win.document.close();
    win.focus();
    win.print();
  }, [data]);

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
                  onClick={openPrintWindow}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white dark:text-[#0B111A] transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Open print report (save as PDF)
                </button>
                {txtFallback && (
                  <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Your browser blocked the print window, so a plain-text (.txt) copy of this
                    report was downloaded instead — it is not a PDF. Open the file, then use your
                    device&apos;s Share or Print action to save it as a PDF if you need one.
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
