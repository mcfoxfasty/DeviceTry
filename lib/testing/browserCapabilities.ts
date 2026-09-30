/**
 * Browser capability matrix.
 *
 * WHAT WENT WRONG BEFORE: every row was a boolean produced by an `in` check or
 * a property-existence test, which produced two distinct lies:
 *  - `pictureInPictureEnabled in document` reported "Supported" on a browser
 *    that exposes the property and has picture-in-picture DISABLED. Existence
 *    is not a value.
 *  - `mediaDevices in navigator` reported "Supported" when the object exists
 *    but getUserMedia was missing or not callable — the one function every
 *    media tester actually depends on.
 *
 * FOUR STATES, never a bare boolean:
 *   available — the API is present AND usable (or, where a value is the point,
 *              the value is affirmative: e.g. pictureInPictureEnabled === true)
 *   disabled  — the API is present but the browser reports it switched off.
 *              Different from missing, and actionable in a different way.
 *   missing   — the API is not implemented in this browser.
 *   error     — the probe itself threw.
 *
 * The matrix stays passive: no permission is requested, no media is captured,
 * no request leaves the page. WebGL/2D probing allocates throwaway canvases
 * once and releases the hardware contexts immediately.
 */

export type CapabilityState = 'available' | 'disabled' | 'missing' | 'error';

export interface CapabilityCheck {
  name: string;
  category: string;
  /** What the row actually asserts, shown in the detail column. */
  reads: string;
  probe: () => { state: CapabilityState; detail: string };
}

export interface CapabilityRow {
  name: string;
  category: string;
  reads: string;
  state: CapabilityState;
  detail: string;
}

const functionCheck = (fn: unknown): { state: CapabilityState; detail: string } => {
  if (typeof fn !== 'function') return { state: 'missing', detail: 'not defined' };
  return { state: 'available', detail: 'callable' };
};

const presentCheck = (value: unknown): { state: CapabilityState; detail: string } => {
  if (value === undefined || value === null) return { state: 'missing', detail: 'not defined' };
  if (value === false) return { state: 'disabled', detail: 'present but reported false' };
  return { state: 'available', detail: value === true ? 'present and true' : 'present' };
};

/**
 * The capability matrix. Each probe reads a VALUE, not the existence of a
 * name, so a present-but-disabled API is reported as disabled.
 */
/** Read a dotted path off the global object without assuming any declared shape. */
export function readGlobal(path: string): unknown {
  let current: unknown = globalThis;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

const fn = (path: string): CapabilityCheck['probe'] => () => functionCheck(readGlobal(path));

export const CAPABILITY_CHECKS: readonly CapabilityCheck[] = [
  {
    name: 'Media capture (getUserMedia)',
    category: 'Media',
    reads: 'navigator.mediaDevices.getUserMedia is a function',
    // Not `mediaDevices in navigator`: the object can exist while the one
    // function every media tester depends on is missing or not callable.
    probe: fn('navigator.mediaDevices.getUserMedia'),
  },
  { name: 'MediaRecorder', category: 'Media', reads: 'MediaRecorder constructor', probe: fn('MediaRecorder') },
  {
    name: 'Media Session',
    category: 'Media',
    reads: 'navigator.mediaSession present',
    probe: () => presentCheck(readGlobal('navigator.mediaSession')),
  },
  {
    name: 'Picture-in-Picture (video)',
    category: 'Media',
    reads: 'document.pictureInPictureEnabled VALUE',
    probe: () => {
      const value = readGlobal('document.pictureInPictureEnabled');
      if (value === undefined) return { state: 'missing', detail: 'property not defined' };
      // Existence is not availability: false means exposed but switched off.
      if (value === true) return { state: 'available', detail: 'pictureInPictureEnabled === true' };
      if (value === false) {
        return { state: 'disabled', detail: 'pictureInPictureEnabled === false — exposed, but off or disallowed here' };
      }
      return { state: 'error', detail: `pictureInPictureEnabled returned ${String(value)}` };
    },
  },
  {
    name: 'Screen capture (getDisplayMedia)',
    category: 'Media',
    reads: 'navigator.mediaDevices.getDisplayMedia is a function',
    probe: fn('navigator.mediaDevices.getDisplayMedia'),
  },
  {
    name: 'Web Audio (AudioContext)',
    category: 'Audio',
    reads: 'AudioContext or webkitAudioContext constructor',
    probe: () =>
      typeof readGlobal('AudioContext') === 'function'
        ? { state: 'available', detail: 'AudioContext callable' }
        : functionCheck(readGlobal('webkitAudioContext')),
  },
  { name: 'AudioWorklet', category: 'Audio', reads: 'AudioWorklet constructor', probe: fn('AudioWorklet') },
  {
    name: 'Speech Synthesis',
    category: 'Audio',
    reads: 'speechSynthesis.getVoices is a function',
    probe: fn('speechSynthesis.getVoices'),
  },
  {
    name: 'Speech Recognition',
    category: 'Audio',
    reads: 'SpeechRecognition or webkitSpeechRecognition constructor',
    probe: () =>
      typeof readGlobal('SpeechRecognition') === 'function'
        ? { state: 'available', detail: 'SpeechRecognition callable' }
        : functionCheck(readGlobal('webkitSpeechRecognition')),
  },
  { name: 'WebGL 1.0', category: 'Graphics', reads: 'a webgl context can actually be created', probe: () => contextProbe('webgl') },
  { name: 'WebGL 2.0', category: 'Graphics', reads: 'a webgl2 context can actually be created', probe: () => contextProbe('webgl2') },
  { name: 'Canvas 2D', category: 'Graphics', reads: 'a 2d context can actually be created', probe: () => contextProbe('2d') },
  {
    name: 'OffscreenCanvas',
    category: 'Graphics',
    reads: 'OffscreenCanvas constructor',
    probe: fn('OffscreenCanvas'),
  },
  {
    name: 'WebGPU',
    category: 'Graphics',
    reads: 'navigator.gpu.requestAdapter is a function',
    probe: fn('navigator.gpu.requestAdapter'),
  },
  {
    name: 'WebAssembly',
    category: 'Runtime',
    reads: 'WebAssembly.instantiate is a function',
    probe: fn('WebAssembly.instantiate'),
  },
  { name: 'Web Workers', category: 'Runtime', reads: 'Worker constructor', probe: fn('Worker') },
  {
    name: 'Service Worker',
    category: 'Runtime',
    reads: 'navigator.serviceWorker.register is a function',
    probe: fn('navigator.serviceWorker.register'),
  },
  {
    name: 'Shared Array Buffer',
    category: 'Runtime',
    reads: 'SharedArrayBuffer constructor (absent without cross-origin isolation)',
    probe: fn('SharedArrayBuffer'),
  },
  { name: 'WebCodecs', category: 'Media', reads: 'VideoEncoder constructor', probe: fn('VideoEncoder') },
  { name: 'Gamepad API', category: 'Input', reads: 'navigator.getGamepads is a function', probe: fn('navigator.getGamepads') },
  { name: 'Pointer Events', category: 'Input', reads: 'PointerEvent constructor', probe: fn('PointerEvent') },
  {
    name: 'Touch Events',
    category: 'Input',
    reads: 'TouchEvent constructor or ontouchstart on window',
    probe: () =>
      typeof readGlobal('TouchEvent') === 'function' || 'ontouchstart' in (globalThis as object)
        ? { state: 'available', detail: 'touch events exposed' }
        : { state: 'missing', detail: 'no TouchEvent and no ontouchstart' },
  },
  {
    name: 'Keyboard Lock (fullscreen)',
    category: 'Input',
    reads: 'navigator.keyboard.lock is a function',
    probe: fn('navigator.keyboard.lock'),
  },
  { name: 'Vibration API', category: 'Input', reads: 'navigator.vibrate is a function', probe: fn('navigator.vibrate') },
  {
    name: 'Battery Status',
    category: 'Sensors',
    reads: 'navigator.getBattery is a function',
    probe: fn('navigator.getBattery'),
  },
  {
    name: 'Device motion',
    category: 'Sensors',
    reads: 'DeviceMotionEvent exposed',
    probe: () => presentCheck(readGlobal('DeviceMotionEvent')),
  },
  {
    name: 'Device orientation',
    category: 'Sensors',
    reads: 'DeviceOrientationEvent exposed',
    probe: () => presentCheck(readGlobal('DeviceOrientationEvent')),
  },
  {
    name: 'Geolocation',
    category: 'Sensors',
    reads: 'navigator.geolocation.getCurrentPosition is a function',
    probe: fn('navigator.geolocation.getCurrentPosition'),
  },
  {
    name: 'Clipboard (async)',
    category: 'Storage',
    reads: 'navigator.clipboard.readText is a function',
    probe: fn('navigator.clipboard.readText'),
  },
  {
    name: 'Storage quota',
    category: 'Storage',
    reads: 'navigator.storage.estimate is a function',
    probe: fn('navigator.storage.estimate'),
  },
  { name: 'IndexedDB', category: 'Storage', reads: 'indexedDB.open is a function', probe: fn('indexedDB.open') },
  { name: 'Cache Storage', category: 'Storage', reads: 'caches.open is a function', probe: fn('caches.open') },
  {
    name: 'Notifications',
    category: 'System',
    // The function's existence is checked. It is never called: asking would
    // trigger a permission prompt, and this matrix stays passive.
    reads: 'Notification.requestPermission is a function (never called)',
    probe: fn('Notification.requestPermission'),
  },
  { name: 'Permissions API', category: 'System', reads: 'navigator.permissions.query is a function', probe: fn('navigator.permissions.query') },
  { name: 'Web Share', category: 'System', reads: 'navigator.share is a function', probe: fn('navigator.share') },
  {
    name: 'Fullscreen API',
    category: 'System',
    reads: 'Element.prototype.requestFullscreen is a function',
    probe: fn('Element.prototype.requestFullscreen'),
  },
  { name: 'RTCPeerConnection', category: 'Network', reads: 'RTCPeerConnection constructor', probe: fn('RTCPeerConnection') },
  { name: 'WebSocket', category: 'Network', reads: 'WebSocket constructor', probe: fn('WebSocket') },
  { name: 'WebTransport', category: 'Network', reads: 'WebTransport constructor', probe: fn('WebTransport') },
] as const;

function contextProbe(kind: 'webgl' | 'webgl2' | '2d'): { state: CapabilityState; detail: string } {
  try {
    const doc = (globalThis as { document?: { createElement?: (tag: string) => unknown } }).document;
    if (!doc?.createElement) return { state: 'error', detail: 'document.createElement unavailable' };
    const canvas = doc.createElement('canvas') as { getContext?: (id: string) => unknown } | null;
    const ctx = canvas?.getContext?.(kind) ?? null;
    if (!ctx) return { state: 'missing', detail: `no ${kind} context could be created` };
    // Release the hardware context immediately — the probe must not keep a GPU
    // resource alive for the life of the page.
    if (kind !== '2d') {
      const ext = (ctx as { getExtension?: (id: string) => { loseContext?: () => void } | null }).getExtension?.('WEBGL_lose_context');
      ext?.loseContext?.();
    }
    return { state: 'available', detail: `${kind} context created and released` };
  } catch (err) {
    return { state: 'error', detail: err instanceof Error ? err.message : 'context probe threw' };
  }
}

/** Run every check once and return the rows. Never throws. */
export function evaluateCapabilities(checks: readonly CapabilityCheck[] = CAPABILITY_CHECKS): CapabilityRow[] {
  return checks.map((check) => {
    try {
      const { state, detail } = check.probe();
      return { name: check.name, category: check.category, reads: check.reads, state, detail };
    } catch (err) {
      return {
        name: check.name,
        category: check.category,
        reads: check.reads,
        state: 'error',
        detail: err instanceof Error ? err.message : 'probe threw',
      };
    }
  });
}

export const CAPABILITY_CATEGORIES: readonly string[] = [
  'All',
  ...Array.from(new Set(CAPABILITY_CHECKS.map((check) => check.category))),
];

export interface CapabilityFilter {
  query: string;
  category: string;
}

/** Pure search + category filter, shared by the UI and by its tests. */
export function filterCapabilities(rows: readonly CapabilityRow[], filter: CapabilityFilter): CapabilityRow[] {
  // Every whitespace-separated word has to match somewhere, so "media devices"
  // and "devices" both work instead of the space silently killing the search.
  const words = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.category !== 'All' && row.category !== filter.category) return false;
    if (words.length === 0) return true;
    const haystack = `${row.name} ${row.category} ${row.reads}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export interface CapabilityCounts {
  available: number;
  disabled: number;
  missing: number;
  error: number;
  total: number;
}

export function countCapabilities(rows: readonly CapabilityRow[]): CapabilityCounts {
  const counts: CapabilityCounts = { available: 0, disabled: 0, missing: 0, error: 0, total: rows.length };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

export interface CapabilitySummary {
  status: 'measured' | 'inconclusive';
  details: string;
  /** Reusable metrics: counts only, so the shared export never carries payloads. */
  metrics: Record<string, number | boolean>;
}

/**
 * Verdict for a completed capability read.
 *
 * There is deliberately no "passed" case: a matrix of passive property reads
 * cannot certify that the corresponding hardware or permission works, only
 * that the API surface answered. An all-error read says we learned nothing and
 * is reported as inconclusive rather than as a completed measurement.
 */
export function summarizeCapabilities(counts: CapabilityCounts): CapabilitySummary {
  const { available, disabled, missing, error, total } = counts;

  if (total === 0 || error === total) {
    return {
      status: 'inconclusive',
      details:
        error === total
          ? `All ${total} capability probes threw, so nothing could be read about this browser. This is a probe ` +
            `failure, not an absence of features.`
          : 'No capability checks were run, so there is nothing to report.',
      metrics: { checked: total, available: 0, exposedOff: 0, missing: 0, probeErrors: error },
    };
  }

  const read = total - error;
  return {
    status: 'measured',
    details:
      `Read ${read} of ${total} capabilities without error: ${available} available, ${disabled} exposed but switched ` +
      `off, ${missing} missing` +
      (error > 0 ? `, and ${error} probe error${error === 1 ? '' : 's'} that were not read.` : '.') +
      ' This is a static read of what the browser exposes — it requests no permission and proves no hardware works.',
    metrics: { checked: total, available, exposedOff: disabled, missing, probeErrors: error },
  };
}
