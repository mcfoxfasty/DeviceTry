'use client';

import React, { useState } from 'react';
import { Film, Play } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

type Support = 'yes' | 'maybe' | 'no';

type CodecKind = 'video' | 'audio' | 'recording';

interface CodecRow {
  name: string;
  mime: string;
  kind: CodecKind;
  result: Support;
  detail: string;
}

interface ProbeType {
  name: string;
  mime: string;
  kind?: CodecKind;
}

const RECORDING_TYPES: ProbeType[] = [
  { name: 'WebM (VP8 + Opus)', mime: 'video/webm;codecs=vp8,opus' },
  { name: 'WebM (VP9 + Opus)', mime: 'video/webm;codecs=vp9,opus' },
  { name: 'WebM (AV1)', mime: 'video/webm;codecs=av01' },
  { name: 'MP4 (H.264 + AAC)', mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' },
  { name: 'Audio-only WebM (Opus)', mime: 'audio/webm;codecs=opus' },
  { name: 'Audio-only Ogg', mime: 'audio/ogg;codecs=opus' },
];

const PLAYBACK_TYPES: ProbeType[] = [
  { name: 'H.264 (AVC) MP4', mime: 'video/mp4; codecs="avc1.42E01E"' },
  { name: 'H.265 / HEVC', mime: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
  { name: 'VP9 WebM', mime: 'video/webm; codecs="vp9"' },
  { name: 'AV1 MP4', mime: 'video/mp4; codecs="av01.0.05M.08"' },
  { name: 'AAC audio', mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { name: 'MP3', mime: 'audio/mpeg' },
  { name: 'FLAC', mime: 'audio/flac' },
  { name: 'Opus in Ogg', mime: 'audio/ogg; codecs="opus"' },
];

export function CodecSupportTester({ onResultUpdate }: TesterProps) {
  const [rows, setRows] = useState<CodecRow[] | null>(null);

  const probe = () => {
    const results: CodecRow[] = [];

    for (const t of RECORDING_TYPES) {
      let result: Support = 'no';
      try {
        if (typeof MediaRecorder !== 'undefined') {
          result = MediaRecorder.isTypeSupported(t.mime) ? 'yes' : 'no';
        }
      } catch {
        result = 'no';
      }
      results.push({
        name: t.name,
        mime: t.mime,
        kind: 'recording',
        result,
        detail: typeof MediaRecorder === 'undefined' ? 'MediaRecorder unavailable' : 'MediaRecorder.isTypeSupported()',
      });
    }

    const video = document.createElement('video');
    const audio = document.createElement('audio');
    for (const t of PLAYBACK_TYPES) {
      const el = t.kind === 'audio' ? audio : video;
      const verdict = el.canPlayType(t.mime);
      results.push({
        name: t.name,
        mime: t.mime,
        kind: t.mime.startsWith('audio') ? 'audio' : 'video',
        result: verdict === 'probably' ? 'yes' : verdict === 'maybe' ? 'maybe' : 'no',
        detail: `canPlayType → "${verdict || ''}"`,
      });
    }

    setRows(results);
    const yes = results.filter((r) => r.result === 'yes').length;
    onResultUpdate?.('passed', `${yes}/${results.length} codec profiles positively supported`);
  };

  const badge = (r: Support) =>
    r === 'yes'
      ? 'bg-emerald-100 text-emerald-800'
      : r === 'maybe'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-500';

  const label = (r: Support) => (r === 'yes' ? 'Supported' : r === 'maybe' ? 'Maybe' : 'Missing');

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Codec &amp; Container Support</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Recording formats and playback decoding capabilities</p>
          </div>
        </div>
        <button
          onClick={probe}
          className="px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" /> Run Codec Probe
        </button>
      </div>

      {rows ? (
        <div className="mt-5 rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden max-h-[420px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F9] dark:bg-[#192332] sticky top-0">
              <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
                <th className="py-2.5 px-4 font-semibold">Codec / Container</th>
                <th className="py-2.5 px-4 font-semibold w-24">Kind</th>
                <th className="py-2.5 px-4 font-semibold w-28">Status</th>
                <th className="py-2.5 px-4 font-semibold hidden md:table-cell">Detection Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                  <td className="py-2 px-4">
                    <p className="font-medium text-[#142033] dark:text-[#E9EEF4]">{row.name}</p>
                    <p className="font-mono-num text-[10px] text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">{row.mime}</p>
                  </td>
                  <td className="py-2 px-4 text-[#5F6B7A] dark:text-[#9AA6B8] capitalize">{row.kind}</td>
                  <td className="py-2 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge(row.result)}`}>
                      {label(row.result)}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-[#5F6B7A] dark:text-[#9AA6B8] hidden md:table-cell">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 p-8 border border-dashed border-[#DFE5EB] dark:border-[#223043] rounded-lg text-center text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">
          Press Run Codec Probe to detect which recording and playback formats this browser supports.
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">
        Playback detection uses HTMLMediaElement.canPlayType() heuristics (&quot;probably&quot; / &quot;maybe&quot;). Recording detection queries MediaRecorder.isTypeSupported() — a missing profile means the Voice Recorder tool will fall back to another container.
      </div>
    </div>
  );
}
