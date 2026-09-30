'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, Trash2, Eye, FileDown, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import {
  getLocalInspections,
  deleteLocalInspection,
  clearAllLocalInspections,
  subscribeLocalInspections,
  LocalInspectionItem,
} from '@/lib/testing/localHistory';
import { savedRecordPdfFilename, savedRecordReport, savedRecordReportText } from '@/lib/inspection/savedReport';
import { OUTCOME_LABEL, SCOPE_NOTICE } from '@/lib/inspection/stepOutcomes';
import { buildPdf, pdfBlob, reportLinesFromText } from '@/lib/testing/pdf';
import { deliverOnce } from '@/lib/testing/deliver';

interface LocalHistoryListProps {
  t: Translations;
}

const SUMMARY_TONE: Record<string, string> = {
  passed: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  inconclusive: 'bg-slate-100 text-slate-700',
};

export function LocalHistoryList({ t }: LocalHistoryListProps) {
  const [localInspections, setLocalInspections] = useState<LocalInspectionItem[]>([]);
  // Which saved record is open, and the last download error. One expanded
  // record at a time keeps the list readable on a phone.
  const [openId, setOpenId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Set false on unmount so a storage event, or a failed download, that
  // resolves after this component is gone cannot write into dead state.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Reading localStorage during render would make the server and client
    // markup differ, so the first read happens after mount.
    const refresh = () => {
      if (!mountedRef.current) return;
      setLocalInspections(getLocalInspections());
    };
    refresh();
    // Completing an inspection saves it from another component, and a second
    // tab can add or delete one at any time. Reading only on mount left this
    // list showing a stale (often empty) history until the page was reloaded.
    const unsubscribe = subscribeLocalInspections(refresh);
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const handleDeleteLocal = (id: string) => {
    deleteLocalInspection(id);
    if (!mountedRef.current) return;
    setOpenId((current) => (current === id ? null : current));
    setLocalInspections(getLocalInspections());
  };

  const handleClearAllLocal = () => {
    if (confirm('Clear all locally saved inspections from this browser?')) {
      clearAllLocalInspections();
      if (!mountedRef.current) return;
      setOpenId(null);
      setLocalInspections([]);
    }
  };

  /**
   * Export THIS record, not the page.
   *
   * The previous control called `window.print()`, which printed whatever the
   * browser happened to be showing — a saved record's button produced a print
   * of the live report, or of an unrelated page, and never the record that was
   * clicked. The file is now generated from the record's own stored results,
   * metadata, notes and original timestamp.
   */
  const downloadRecordPdf = useCallback(async (record: LocalInspectionItem) => {
    setDownloadError(null);
    try {
      const model = reportLinesFromText(savedRecordReportText(record));
      const blob = pdfBlob(buildPdf({ title: model.title, lines: model.lines }), model.title);
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      await deliverOnce(blob, savedRecordPdfFilename(record), {
        share: typeof nav.share === 'function' ? nav.share.bind(nav) : undefined,
        canShare: typeof nav.canShare === 'function' ? nav.canShare.bind(nav) : undefined,
        createObjectURL: (b) => URL.createObjectURL(b),
        startDownload: (url, name) => {
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        },
      });
    } catch {
      if (mountedRef.current) {
        setDownloadError('This report could not be generated in your browser. The saved record is unchanged.');
      }
    }
  }, []);

  return (
    <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div>
          <h3 className="text-lg font-semibold text-[#142033] dark:text-[#E9EEF4] flex items-center gap-2">
            <History className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
            Local Inspection History
          </h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
            Hardware inspections saved in your browser local storage
          </p>
        </div>

        {localInspections.length > 0 && (
          <button
            onClick={handleClearAllLocal}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
        Notice: Free device test records run 100% in your local browser and persist in your device local storage.
      </div>

      {downloadError && (
        <p role="alert" className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          {downloadError}
        </p>
      )}

      {localInspections.length > 0 ? (
        <div className="mt-6 space-y-3">
          {localInspections.map((item) => {
            const report = savedRecordReport(item);
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex flex-col gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">
                        {item.deviceLabel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          SUMMARY_TONE[report.summaryStatus] ?? SUMMARY_TONE.inconclusive
                        }`}
                      >
                        {report.summaryStatus}
                      </span>
                    </div>

                    <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
                      {new Date(item.createdAt).toLocaleString()} • Inspector: {item.operatorName || 'Anonymous'}
                      {item.updatedAt && item.updatedAt > (item.createdAt ?? 0) ? ' • Re-run' : ''}
                    </p>
                    <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">{report.checklistLabel}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'View'} report for ${item.deviceLabel}`}
                      className="px-3 py-1.5 bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md text-xs font-medium hover:border-[#0F766E] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Report
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => void downloadRecordPdf(item)}
                      aria-label={`Download PDF for ${item.deviceLabel}`}
                      title="Download this record as a PDF"
                      className="px-3 py-1.5 bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md text-xs font-medium hover:border-[#0F766E] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
                    </button>

                    <button
                      onClick={() => handleDeleteLocal(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete Record"
                      aria-label={`Delete record ${item.deviceLabel}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* The stored report, rebuilt from this record alone. */}
                {isOpen && (
                  <div className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 space-y-4">
                    {report.provenanceLine && (
                      <p className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{report.provenanceLine}</span>
                      </p>
                    )}

                    <p className="text-xs font-semibold text-[#142033] dark:text-[#E9EEF4]">{report.summaryLine}</p>

                    {report.rows.length > 0 ? (
                      <ul className="space-y-2">
                        {report.rows.map((row) => (
                          <li key={row.step} className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
                            <span className="font-semibold text-[#142033] dark:text-[#E9EEF4]">{row.label}</span> —{' '}
                            {OUTCOME_LABEL[row.outcome]} ({row.sourceLabel})
                            {row.details ? `: ${row.details}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
                        This record holds no per-check results.
                      </p>
                    )}

                    {report.unverifiedCount > 0 && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-200">
                        {report.unverifiedCount} check{report.unverifiedCount === 1 ? '' : 's'} in this record remained
                        unverified when it was saved.
                      </p>
                    )}

                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
                        Notes
                      </p>
                      <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 whitespace-pre-wrap">
                        {report.notes.trim() ? report.notes : 'No notes were recorded for this inspection.'}
                      </p>
                    </div>

                    <p className="text-[10px] text-[#8996A6] dark:text-[#9AA6B8] leading-relaxed">{SCOPE_NOTICE}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 py-12 text-center text-[#5F6B7A] dark:text-[#9AA6B8]">
          <History className="w-10 h-10 mx-auto opacity-40 mb-2" />
          <p className="text-sm font-medium">No Local Inspections Recorded</p>
          <p className="text-xs mt-1">Run a guided inspection to see your local results history here.</p>
        </div>
      )}
    </div>
  );
}
