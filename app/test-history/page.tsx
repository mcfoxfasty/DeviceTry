'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Trash2, ArrowLeft, ClipboardList } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n';
import {
  getTestHistory,
  deleteTestHistoryEntry,
  clearAllTestHistory,
  TestHistoryEntry,
} from '@/lib/testing/testHistory';

/**
 * Test History (post-deployment correction D): an accessible view of the
 * browser-local, privacy-safe per-test history. Storage contains ONLY test
 * name, status, a safe one-line summary, and a timestamp (lib/testing/
 * testHistory.ts); delete-one and clear-all are provided, and the empty
 * state links users into the catalog.
 */
export default function TestHistoryPage() {
  const t = getDictionary();
  const [entries, setEntries] = useState<TestHistoryEntry[] | null>(null);

  // Defer the first read to a macrotask so nothing touches localStorage
  // during hydration; the page is client-rendered only.
  useEffect(() => {
    const timer = setTimeout(() => setEntries(getTestHistory()), 0);
    return () => clearTimeout(timer);
  }, []);

  const removeOne = (id: string) => {
    deleteTestHistoryEntry(id);
    setEntries(getTestHistory());
  };

  const clearAll = () => {
    if (confirm('Clear your entire test history from this browser? This cannot be undone.')) {
      clearAllTestHistory();
      setEntries([]);
    }
  };

  const statusPill = (status: TestHistoryEntry['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-[#192332] dark:text-[#9AA6B8]';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      <Navbar t={t} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Home
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DFE5EB] dark:border-[#223043]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <History className="w-6 h-6 text-[#0F766E] dark:text-[#14B8A6]" aria-hidden="true" />
              Test History
            </h1>
            <p className="text-sm text-[#5F6B7A] dark:text-[#9AA6B8] mt-1.5 leading-relaxed max-w-xl">
              Results you completed on this device, stored only in this browser. Each entry keeps
              the test name, its outcome, a short summary, and the time — never recordings, IP
              addresses, keystrokes, or clipboard content. Clearing your browser data also clears
              this history.
            </p>
          </div>
          {entries && entries.length > 0 && (
            <button
              onClick={clearAll}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#131B27] border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear all
            </button>
          )}
        </div>

        {entries === null ? (
          <div className="py-16 text-center text-xs text-[#8996A6]">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="mt-12 py-16 text-center" role="status">
            <ClipboardList className="w-12 h-12 mx-auto text-[#8996A6] opacity-40 mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold">No test history yet</p>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1.5 max-w-sm mx-auto leading-relaxed">
              Run any tester and your result will appear here automatically — stored only in this
              browser.
            </p>
            <Link
              href="/tests"
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white dark:text-[#0B111A] text-xs font-bold transition-colors"
            >
              Browse all tests
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-2.5">
            {entries.map((e) => (
              <li
                key={e.id}
                className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/test/${e.slug}`}
                      className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] hover:text-[#0F766E] dark:hover:text-[#14B8A6] transition-colors"
                    >
                      {e.title}
                    </Link>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusPill(e.status)}`}
                    >
                      {e.status}
                    </span>
                  </div>
                  {e.summary && (
                    <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1 leading-relaxed">
                      {e.summary}
                    </p>
                  )}
                  <p className="text-[11px] text-[#8996A6] mt-1">
                    <time dateTime={new Date(e.timestamp).toISOString()}>
                      {new Date(e.timestamp).toLocaleString()}
                    </time>
                  </p>
                </div>
                <button
                  onClick={() => removeOne(e.id)}
                  aria-label={`Delete ${e.title} entry from history`}
                  className="shrink-0 p-2 rounded-md text-[#8996A6] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer t={t} />
    </div>
  );
}
