'use client';

import React, { useState } from 'react';
import { ListChecks, Search, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface FeatureEntry {
  name: string;
  category: string;
  check: () => boolean;
}

const FEATURES: FeatureEntry[] = [
  { name: 'MediaDevices (getUserMedia)', category: 'Media', check: () => 'mediaDevices' in navigator },
  { name: 'MediaRecorder', category: 'Media', check: () => typeof MediaRecorder !== 'undefined' },
  { name: 'MediaSession', category: 'Media', check: () => 'mediaSession' in navigator },
  { name: 'Picture-in-Picture (video)', category: 'Media', check: () => 'pictureInPictureEnabled' in document },
  { name: 'Screen Capture (getDisplayMedia)', category: 'Media', check: () => 'getDisplayMedia' in navigator.mediaDevices },
  { name: 'Web Audio (AudioContext)', category: 'Audio', check: () => 'AudioContext' in window || 'webkitAudioContext' in window },
  { name: 'AudioWorklet', category: 'Audio', check: () => 'AudioWorklet' in window },
  { name: 'Speech Synthesis', category: 'Audio', check: () => 'speechSynthesis' in window },
  { name: 'Speech Recognition', category: 'Audio', check: () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window },
  { name: 'WebGL 1.0', category: 'Graphics', check: () => !!document.createElement('canvas').getContext('webgl') },
  { name: 'WebGL 2.0', category: 'Graphics', check: () => !!document.createElement('canvas').getContext('webgl2') },
  { name: 'Canvas 2D', category: 'Graphics', check: () => !!document.createElement('canvas').getContext('2d') },
  { name: 'OffscreenCanvas', category: 'Graphics', check: () => 'OffscreenCanvas' in window },
  { name: 'WebGPU', category: 'Graphics', check: () => 'gpu' in navigator },
  { name: 'WebAssembly', category: 'Runtime', check: () => 'WebAssembly' in window },
  { name: 'Web Workers', category: 'Runtime', check: () => 'Worker' in window },
  { name: 'Service Worker', category: 'Runtime', check: () => 'serviceWorker' in navigator },
  { name: 'Shared Array Buffer', category: 'Runtime', check: () => 'SharedArrayBuffer' in window },
  { name: 'WebCodecs', category: 'Media', check: () => 'VideoEncoder' in window },
  { name: 'Gamepad API', category: 'Input', check: () => 'getGamepads' in navigator },
  { name: 'Pointer Events', category: 'Input', check: () => 'PointerEvent' in window },
  { name: 'Touch Events', category: 'Input', check: () => 'ontouchstart' in window || 'TouchEvent' in window },
  { name: 'Keyboard Lock (fullscreen)', category: 'Input', check: () => 'keyboard' in navigator && 'lock' in (navigator as { keyboard?: { lock?: unknown } }).keyboard! },
  { name: 'Vibration API', category: 'Input', check: () => 'vibrate' in navigator },
  { name: 'Battery Status', category: 'Sensors', check: () => 'getBattery' in navigator },
  { name: 'DeviceMotion', category: 'Sensors', check: () => 'DeviceMotionEvent' in window },
  { name: 'DeviceOrientation', category: 'Sensors', check: () => 'DeviceOrientationEvent' in window },
  { name: 'Ambient Light Sensor', category: 'Sensors', check: () => 'AmbientLightSensor' in window },
  { name: 'Geolocation', category: 'Sensors', check: () => 'geolocation' in navigator },
  { name: 'Clipboard (async)', category: 'Storage', check: () => 'clipboard' in navigator },
  { name: 'Storage Manager (quota)', category: 'Storage', check: () => 'storage' in navigator && 'estimate' in navigator.storage },
  { name: 'IndexedDB', category: 'Storage', check: () => 'indexedDB' in window },
  { name: 'Cache Storage', category: 'Storage', check: () => 'caches' in window },
  { name: 'Notifications', category: 'System', check: () => 'Notification' in window },
  { name: 'Permissions API', category: 'System', check: () => 'permissions' in navigator },
  { name: 'Web Share', category: 'System', check: () => 'share' in navigator },
  { name: 'Fullscreen API', category: 'System', check: () => document.documentElement.requestFullscreen !== undefined },
  { name: 'RTCPeerConnection', category: 'Network', check: () => 'RTCPeerConnection' in window },
  { name: 'WebSocket', category: 'Network', check: () => 'WebSocket' in window },
  { name: 'WebTransport', category: 'Network', check: () => 'WebTransport' in window },
];

const CATEGORIES = ['All', 'Media', 'Audio', 'Graphics', 'Runtime', 'Input', 'Sensors', 'Storage', 'System', 'Network'];

export function BrowserCompatibilityTester({ onResultUpdate }: TesterProps) {
  const [filter, setFilter] = useState<string>('All');
  const [query, setQuery] = useState<string>('');

  const results = FEATURES.map((f) => ({ ...f, supported: f.check() }));
  const visible = results.filter(
    (r) => (filter === 'All' || r.category === filter) && r.name.toLowerCase().includes(query.toLowerCase())
  );
  const supportedCount = results.filter((r) => r.supported).length;

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">Browser Feature Compatibility Matrix</h3>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Passive read-only capability detection — no permissions prompted</p>
          </div>
        </div>
        <div className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">
          <span className="text-emerald-600 dark:text-emerald-400">{supportedCount}</span> / {results.length} APIs supported
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search APIs…"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-xs text-[#142033] dark:text-[#E9EEF4] focus:outline-none focus:border-[#0F766E]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                filter === c
                  ? 'bg-[#0F766E] text-white'
                  : 'bg-[#F6F7F9] dark:bg-[#192332] text-[#5F6B7A] dark:text-[#9AA6B8] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] overflow-hidden max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F7F9] dark:bg-[#192332] sticky top-0">
            <tr className="text-[#5F6B7A] dark:text-[#9AA6B8]">
              <th className="py-2.5 px-4 font-semibold">Web API</th>
              <th className="py-2.5 px-4 font-semibold w-24">Category</th>
              <th className="py-2.5 px-4 font-semibold w-28">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
            {visible.map((r) => (
              <tr key={r.name} className="hover:bg-[#F6F7F9] dark:hover:bg-[#192332]">
                <td className="py-2 px-4 text-[#142033] dark:text-[#E9EEF4] font-medium">{r.name}</td>
                <td className="py-2 px-4 text-[#5F6B7A] dark:text-[#9AA6B8]">{r.category}</td>
                <td className="py-2 px-4">
                  {r.supported ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                      <CheckCircle className="w-3 h-3" /> Supported
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                      <XCircle className="w-3 h-3" /> Missing
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-[#5F6B7A] dark:text-[#9AA6B8]">
                  <MinusCircle className="w-6 h-6 mx-auto mb-1 opacity-40" />
                  No APIs match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
