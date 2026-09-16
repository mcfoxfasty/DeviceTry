'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Cpu, MonitorSmartphone, Wifi, CheckCircle, XCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface SystemInfo {
  userAgent: string;
  platform: string;
  language: string;
  languages: string;
  cpuCores: string;
  deviceMemory: string;
  maxTouchPoints: string;
  cookieEnabled: string;
  onlineStatus: string;
  connection: string;
  networkType: string;
  networkDownlink: string;
  vendor: string;
}

function parseEngine(ua: string): string {
  if (/Edg\//.test(ua)) return 'Blink (Microsoft Edge)';
  if (/OPR\//.test(ua)) return 'Blink (Opera)';
  if (/Chrome\//.test(ua)) return 'Blink (Chromium)';
  if (/Firefox\//.test(ua)) return 'Gecko (Firefox)';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'WebKit (Safari)';
  return 'Unknown engine';
}

function parseOS(ua: string, platform: string): string {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS / iPadOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua) || /Linux/.test(platform)) return 'Linux';
  return 'Unknown OS';
}

function parseArch(ua: string): string {
  if (/arm|aarch/i.test(ua)) return 'ARM (AArch64)';
  if (/WOW64|x86_64|Win64|amd64/i.test(ua)) return 'x86-64';
  if (/i[36]86/.test(ua)) return 'x86-32';
  return 'Unspecified';
}

function formatBytes(bytes: number): string {
  if (!bytes || !isFinite(bytes)) return 'Unknown';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

export function BrowserSystemInfoTester({ onResultUpdate }: TesterProps) {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { downlink?: number; effectiveType?: string; rtt?: number };
    };

    const conn = nav.connection;
    const networkType = conn?.effectiveType || 'Unknown';
    const networkDownlink = conn?.downlink ? `${conn.downlink} Mbps (RTT ${conn.rtt ?? '?'}ms)` : 'Unknown';

    const data: SystemInfo = {
      userAgent: nav.userAgent,
      platform: nav.platform || 'Unknown',
      language: nav.language,
      languages: (nav.languages || []).join(', '),
      cpuCores: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} logical cores` : 'Not exposed',
      deviceMemory: nav.deviceMemory ? `≈ ${nav.deviceMemory} GB (bucketed)` : 'Not exposed',
      maxTouchPoints: String(nav.maxTouchPoints ?? 0),
      cookieEnabled: nav.cookieEnabled ? 'Enabled' : 'Disabled',
      onlineStatus: nav.onLine ? 'Online' : 'Offline',
      connection: conn?.effectiveType ? `${conn.effectiveType.toUpperCase()}` : 'Network Information API not exposed',
      networkType,
      networkDownlink,
      vendor: nav.vendor || 'Not exposed',
    };
    setInfo(data);
    onResultUpdate?.('passed', `Engine: ${parseEngine(nav.userAgent)} • ${parseOS(nav.userAgent, nav.platform)} • ${data.cpuCores}`);
  }, [onResultUpdate]);

  if (!info) {
    return (
      <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
        <div className="p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          Reading navigator properties…
        </div>
      </div>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Browser Engine', value: parseEngine(info.userAgent) },
    { label: 'Operating System', value: parseOS(info.userAgent, info.platform) },
    { label: 'Architecture', value: parseArch(info.userAgent) },
    { label: 'Logical CPU Cores', value: info.cpuCores },
    { label: 'Device Memory', value: info.deviceMemory },
    { label: 'Platform String', value: info.platform },
    { label: 'Vendor', value: info.vendor },
    { label: 'Language(s)', value: `${info.language}${info.languages ? ` (${info.languages})` : ''}` },
    { label: 'Max Touch Points', value: info.maxTouchPoints },
    { label: 'Cookies', value: info.cookieEnabled },
    { label: 'Network Type', value: info.networkType },
    { label: 'Downlink Estimate', value: info.networkDownlink },
    { label: 'Connection Status', value: info.onlineStatus },
  ];

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Browser &amp; System Information</h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Legitimately exposed navigator properties only — no fingerprinting</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center gap-3">
          <Globe className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">Engine</p>
            <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4]">{parseEngine(info.userAgent)}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center gap-3">
          <MonitorSmartphone className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">OS</p>
            <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4]">{parseOS(info.userAgent, info.platform)}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] flex items-center gap-3">
          <Cpu className="w-5 h-5 text-[#0F766E] dark:text-[#14B8A6]" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#5F6B7A] dark:text-[#9AA6B8] font-semibold">CPU / Memory</p>
            <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4]">{info.cpuCores} • {info.deviceMemory}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#DFE5EB] dark:border-[#223043]">
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                <td className="py-2.5 px-4 font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] w-56">{row.label}</td>
                <td className="py-2.5 px-4 font-mono-num text-[#142033] dark:text-[#E9EEF4] break-all">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-semibold text-[#0F766E] dark:text-[#14B8A6] flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5" /> Show full User-Agent string
        </summary>
        <p className="mt-2 p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] font-mono-num text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] break-all">
          {info.userAgent}
        </p>
      </details>

      <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        <CheckCircle className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
        Privacy note: DeviceMemory is deliberately bucketed by browsers and CPU cores are capped; this tool only displays what the browser exposes — no confidential hardware serials are queried.
      </div>
    </div>
  );
}
