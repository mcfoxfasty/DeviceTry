'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Globe2, Calendar } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function getUtcOffsetMinutes(date: Date): number {
  return -date.getTimezoneOffset();
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isDstObserved(date: Date): boolean | null {
  try {
    const year = date.getFullYear();
    const jan = new Date(year, 0, 1).getTimezoneOffset();
    const jul = new Date(year, 6, 1).getTimezoneOffset();
    const std = Math.max(jan, jul);
    return date.getTimezoneOffset() !== std;
  } catch {
    return null;
  }
}

export function ClockTimezoneTester({ locale, onResultUpdate }: TesterProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [dst, setDst] = useState<boolean | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!now) return;
    setDst(isDstObserved(now));
    const tz = getTimezone();
    const offset = getUtcOffsetMinutes(now);
    onResultUpdate?.('passed', `Timezone ${tz} (${formatOffset(offset)})`);
  }, [now, onResultUpdate]);

  if (!now) {
    return (
      <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
        <div className="p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          Reading system clock…
        </div>
      </div>
    );
  }

  const tz = getTimezone();
  const offsetMin = getUtcOffsetMinutes(now);
  const localeStr = locale || 'en';

  const cards = [
    { icon: <Clock className="w-4 h-4" />, label: 'Local System Time', value: now.toLocaleTimeString(localeStr), sub: now.toLocaleDateString(localeStr, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
    { icon: <Globe2 className="w-4 h-4" />, label: 'IANA Time Zone', value: tz, sub: `${offsetMin >= 0 ? 'East' : 'West'} of Greenwich • ${formatOffset(offsetMin)}` },
    { icon: <Calendar className="w-4 h-4" />, label: 'UTC Timestamp', value: now.toUTCString(), sub: `Unix epoch: ${Math.floor(now.getTime() / 1000)}` },
    { icon: <Clock className="w-4 h-4" />, label: 'Daylight Saving', value: dst === null ? 'Unknown' : dst ? 'DST active' : 'Standard time', sub: 'Compared against January/July offsets' },
  ];

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Clock &amp; Timezone Information</h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Live system clock readout — no remote NTP servers queried</p>
        </div>
      </div>

      <div className="mt-5 text-center py-6 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
        <p className="font-mono-num text-5xl font-black text-[#0F766E] dark:text-[#14B8A6] tracking-tight">
          {now.toLocaleTimeString(localeStr)}
        </p>
        <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-2">
          {formatOffset(offsetMin)} • {tz}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {cards.map((card) => (
          <div key={card.label} className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
              {card.icon}
              {card.label}
            </p>
            <p className="font-mono-num text-sm font-bold text-[#142033] dark:text-[#E9EEF4] mt-1.5 break-all">{card.value}</p>
            <p className="text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] mb-2">Localized Intl formats</p>
        <div className="rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
              {(['en-US', 'fr-FR', 'ar-SA'] as const).map((loc) => (
                <tr key={loc} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                  <td className="py-2.5 px-4 font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] w-20">{loc}</td>
                  <td className="py-2.5 px-4 text-[#142033] dark:text-[#E9EEF4]">
                    {now.toLocaleDateString(loc, { dateStyle: 'full', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        This tool reports the clock configured on your device. If your clock drifts, enable “Set time automatically” in your OS settings — a manually mis-set clock is shown here exactly as browsers will see it.
      </div>
    </div>
  );
}
