'use client';

import React, { useState } from 'react';
import { ClipboardCopy, ClipboardPaste, ClipboardCheck, XCircle, CheckCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface LogEntry {
  time: string;
  message: string;
  ok: boolean;
}

const SAMPLE_TEXT = 'DeviceTry clipboard test ✓ — copied at ' + new Date().getFullYear();

export function ClipboardTester({ onResultUpdate }: TesterProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copiedText, setCopiedText] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');

  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { clipboard?: Clipboard }) : null;
  const writeSupported = !!nav?.clipboard && typeof nav.clipboard.writeText === 'function';
  const readSupported = !!nav?.clipboard && typeof nav.clipboard.readText === 'function';

  const addLog = (message: string, ok: boolean) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), message, ok }, ...prev].slice(0, 8));
  };

  const handleCopy = async () => {
    if (!writeSupported) {
      addLog('Async clipboard writeText is not available in this browser', false);
      onResultUpdate?.('unsupported', 'Clipboard writeText unavailable');
      return;
    }
    const text = `${SAMPLE_TEXT} ${Date.now()}`;
    try {
      await nav!.clipboard!.writeText(text);
      setCopiedText(text);
      addLog(`writeText() succeeded — "${text.slice(0, 42)}…"`, true);
      onResultUpdate?.('passed', 'Clipboard writeText succeeded');
    } catch (err) {
      addLog(`writeText() failed: ${(err as Error).message}`, false);
      onResultUpdate?.('failed', 'Clipboard write failed');
    }
  };

  const handlePaste = async () => {
    if (!readSupported) {
      addLog('Async clipboard readText is not available (Firefox/Safari restrict it)', false);
      onResultUpdate?.('warning', 'Clipboard readText unavailable');
      return;
    }
    try {
      const text = await nav!.clipboard!.readText();
      setPastedText(text);
      const matches = text === copiedText && copiedText !== '';
      addLog(matches ? 'readText() matched the previously copied sample ✓' : `readText() returned clipboard content (${text.length} chars)`, true);
      onResultUpdate?.('passed', matches ? 'Round-trip copy/paste verified' : 'Clipboard read succeeded');
    } catch (err) {
      addLog(`readText() failed: ${(err as Error).message}`, false);
      onResultUpdate?.('failed', 'Clipboard read failed (permission or focus)');
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
          <ClipboardCopy className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Clipboard Copy &amp; Paste Tester</h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Verifies async writeText() and readText() with user gestures</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          disabled={!writeSupported}
        >
          <ClipboardCopy className="w-3.5 h-3.5" /> Copy Sample Text
        </button>
        <button
          onClick={handlePaste}
          className="px-4 py-2 rounded-lg bg-white dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] text-[#142033] dark:text-[#E9EEF4] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          disabled={!readSupported}
        >
          <ClipboardPaste className="w-3.5 h-3.5" /> Paste from Clipboard
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
          <p className="font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider text-[10px] mb-1.5">Written via writeText()</p>
          <p className="font-mono-num text-[#142033] dark:text-[#E9EEF4] break-all min-h-[2.5rem]">
            {copiedText || <span className="opacity-50">Nothing copied yet…</span>}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
          <p className="font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] uppercase tracking-wider text-[10px] mb-1.5">Read back via readText()</p>
          <p className="font-mono-num text-[#142033] dark:text-[#E9EEF4] break-all min-h-[2.5rem]">
            {pastedText || <span className="opacity-50">Nothing pasted yet…</span>}
          </p>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden">
          <div className="bg-[#F6F7F9] dark:bg-[#192332] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8]">
            Test Log
          </div>
          <div className="divide-y divide-[#DFE5EB] dark:divide-[#223043] max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2 text-xs">
                {log.ok ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                )}
                <span className="font-mono-num text-[#5F6B7A] dark:text-[#9AA6B8] shrink-0">{log.time}</span>
                <span className="text-[#142033] dark:text-[#E9EEF4]">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] flex items-start gap-2">
        <ClipboardCheck className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
        Clipboard read requires an explicit user gesture and a focused document. Firefox exposes writeText() only; content is never stored or uploaded by this tool.
      </div>
    </div>
  );
}
