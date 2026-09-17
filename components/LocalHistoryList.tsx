'use client';

import React, { useState, useEffect } from 'react';
import { History, Trash2, Printer } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';
import {
  getLocalInspections,
  deleteLocalInspection,
  clearAllLocalInspections,
  LocalInspectionItem,
} from '@/lib/testing/localHistory';

interface LocalHistoryListProps {
  t: Translations;
}

export function LocalHistoryList({ t }: LocalHistoryListProps) {
  const [localInspections, setLocalInspections] = useState<LocalInspectionItem[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalInspections(getLocalInspections());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleDeleteLocal = (id: string) => {
    deleteLocalInspection(id);
    setLocalInspections(getLocalInspections());
  };

  const handleClearAllLocal = () => {
    if (confirm('Clear all locally saved inspections from this browser?')) {
      clearAllLocalInspections();
      setLocalInspections([]);
    }
  };

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

      {localInspections.length > 0 ? (
        <div className="mt-6 space-y-3">
          {localInspections.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">
                    {item.deviceLabel}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.summaryStatus === 'passed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.summaryStatus === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {item.summaryStatus}
                  </span>
                </div>

                <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
                  {new Date(item.createdAt).toLocaleString()} • Inspector: {item.operatorName || 'Anonymous'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md text-xs font-medium hover:border-[#0F766E] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>

                <button
                  onClick={() => handleDeleteLocal(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
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
