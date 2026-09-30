/**
 * Browser & system facts — collected as VALUES, labelled by how they were
 * obtained.
 *
 * THE RULE THIS FILE ENFORCES: nothing a browser infers for us is presented
 * as a verified hardware fact.
 *  - Engine, OS and architecture are parsed from the user-agent string. They
 *    are ESTIMATES from a string the browser (and any extension) may rewrite.
 *    Rows say "estimated from user agent", never "verified".
 *  - iOS browsers outside Safari (Chrome/Firefox/Edge on iOS) all carry a
 *    desktop Safari UA under the WebKit engine. They are reported as
 *    "iOS or iPadOS — browser not identifiable from the user agent".
 *  - An iPad in desktop-class mode reports a macOS UA. That is reported as
 *    "macOS or iPadOS (ambiguous)" rather than a confident macOS verdict.
 *  - "ARM" in a UA never implies AArch64: it can be a 32-bit ARM build.
 *  - Screen size, viewport size and device pixel ratio are three SEPARATE
 *    facts. The panel's physical resolution is never stated.
 *  - A zero is a real value (0 logical cores, 0 touch points, DPR cannot be 0
 *    so it is reported unavailable). Absent values are reported as
 *    "Not exposed", never as 0.
 */

/** iOS browsers other than Safari report a desktop Safari UA. */
export function isNonSafariIosBrowser(ua: string): boolean {
  // Only Safari ships a `Version/x.y` token on iOS, but the alternative
  // browsers append their own token instead of replacing it, so the presence
  // of any of them is enough on its own.
  return /iPhone|iPad|iPod/.test(ua) && /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|wv/.test(ua);
}

/** iPadOS desktop-class mode reports a macOS UA; touch points give it away. */
export function isAmbiguousDesktopStyleIpad(ua: string, maxTouchPoints: number): boolean {
  return /Macintosh;/.test(ua) && /Mobile\//.test(ua) === false && maxTouchPoints > 1;
}

export interface UserAgentFacts {
  engine: string;
  engineSource: 'estimated from user agent';
  os: string;
  osConfidence: 'estimated from user agent' | 'ambiguous';
  architecture: string;
  architectureSource: 'estimated from user agent';
  /** Short reason, shown next to any ambiguous or unknown value. */
  note?: string;
}

export function parseEngine(ua: string): string {
  if (/Edg[A-Z]?\//.test(ua)) return 'Blink (Edge)';
  if (/OPR\/|OPiOS\//.test(ua)) return 'Blink (Opera)';
  if (/Chrome\/|CriOS\//.test(ua)) return 'Blink (Chromium)';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Gecko (Firefox)';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'WebKit (Safari-family)';
  return 'Unknown engine';
}

export function parseOperatingSystem(ua: string, platform: string, maxTouchPoints: number): { os: string; confidence: 'estimated from user agent' | 'ambiguous'; note?: string } {
  if (isNonSafariIosBrowser(ua)) {
    return {
      os: 'iOS / iPadOS (browser not identifiable from user agent)',
      confidence: 'estimated from user agent',
      note: 'Browsers other than Safari on iOS deliberately report a desktop Safari string, so the specific browser cannot be read from it.',
    };
  }
  if (/iPhone|iPad|iPod/.test(ua)) {
    return { os: 'iOS / iPadOS', confidence: 'estimated from user agent' };
  }
  if (/Android/.test(ua)) return { os: 'Android', confidence: 'estimated from user agent' };
  if (/Windows NT 10\.0/.test(ua)) {
    return {
      os: 'Windows 10 or 11 (they share a user agent)',
      confidence: 'estimated from user agent',
      note: 'Windows 10 and 11 send the identical "Windows NT 10.0" token, so they cannot be told apart here.',
    };
  }
  if (/Windows/.test(ua)) return { os: 'Windows', confidence: 'estimated from user agent' };
  if (/CrOS/.test(ua)) return { os: 'ChromeOS', confidence: 'estimated from user agent' };
  if (isAmbiguousDesktopStyleIpad(ua, maxTouchPoints)) {
    return {
      os: 'macOS or iPadOS (ambiguous)',
      confidence: 'ambiguous',
      note: 'This user agent describes macOS, but iPadOS in desktop mode reports the same string. Multi-touch points suggest an iPad.',
    };
  }
  if (/Mac OS X|Macintosh/.test(ua)) return { os: 'macOS', confidence: 'estimated from user agent' };
  if (/Linux|X11|CrOS/.test(ua) || /Linux/.test(platform)) return { os: 'Linux', confidence: 'estimated from user agent' };
  return { os: 'Unknown operating system', confidence: 'ambiguous', note: 'No known token was found in the user-agent string.' };
}

export function parseArchitecture(ua: string, platform: string): { value: string; note?: string } {
  // An "ARM" token says the CPU family, not the instruction set: 32-bit ARM
  // builds (e.g. armv7l) exist, so AArch64 is never asserted here.
  if (/arm64|aarch64/i.test(ua) || /aarch64|arm64/i.test(platform)) return { value: 'ARM 64-bit family' };
  if (/arm|aarch/i.test(ua) || /arm/i.test(platform)) {
    return { value: 'ARM family', note: 'The user agent does not distinguish 32-bit from 64-bit ARM builds.' };
  }
  if (/WOW64|x86_64|Win64|x64|amd64/i.test(ua) || /x86_64|amd64/i.test(platform)) return { value: 'x86-64 family' };
  if (/i[3-6]86/i.test(ua)) return { value: 'x86 32-bit family' };
  return { value: 'Not identifiable', note: 'Architecture is not readable from the user agent.' };
}

export function parseUserAgentFacts(ua: string, platform: string, maxTouchPoints: number): UserAgentFacts {
  const os = parseOperatingSystem(ua, platform, maxTouchPoints);
  const arch = parseArchitecture(ua, platform);
  return {
    engine: parseEngine(ua),
    engineSource: 'estimated from user agent',
    os: os.os,
    osConfidence: os.confidence,
    architecture: arch.value,
    architectureSource: 'estimated from user agent',
    note: [os.note, arch.note].filter(Boolean).join(' ') || undefined,
  };
}

export interface ScreenFacts {
  /** screen.width / screen.height — the display area the browser reports. */
  screenWidth: string;
  screenHeight: string;
  availWidth: string;
  availHeight: string;
  colorDepth: string;
  /** innerWidth / innerHeight — the current viewport, which changes with the window. */
  viewportWidth: string;
  viewportHeight: string;
  devicePixelRatio: string;
  /** One sentence saying these are different measurements. */
  note: string;
}

/** Format a measurement, preserving a genuine 0 and labelling absence. */
export function formatMeasurement(value: number | undefined | null, unit = ''): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return 'Not exposed';
  const suffix = unit ? ` ${unit}` : '';
  return `${value}${suffix}`;
}

export function collectScreenFacts(win: {
  screen?: { width?: number; height?: number; availWidth?: number; availHeight?: number; colorDepth?: number };
  innerWidth?: number;
  innerHeight?: number;
  devicePixelRatio?: number;
}): ScreenFacts {
  return {
    screenWidth: formatMeasurement(win.screen?.width, 'CSS px'),
    screenHeight: formatMeasurement(win.screen?.height, 'CSS px'),
    availWidth: formatMeasurement(win.screen?.availWidth, 'CSS px'),
    availHeight: formatMeasurement(win.screen?.availHeight, 'CSS px'),
    colorDepth: formatMeasurement(win.screen?.colorDepth, 'bits per pixel'),
    viewportWidth: formatMeasurement(win.innerWidth, 'CSS px'),
    viewportHeight: formatMeasurement(win.innerHeight, 'CSS px'),
    devicePixelRatio:
      typeof win.devicePixelRatio === 'number' && Number.isFinite(win.devicePixelRatio) && win.devicePixelRatio > 0
        ? `${win.devicePixelRatio} (device pixels per CSS pixel at the current page zoom and OS scaling)`
        : 'Not exposed',
    note:
      'Screen dimensions are the display area the browser reports; viewport dimensions are this window right now, and ' +
      'they change when you resize. The device pixel ratio is the scaling between them. The panel\'s true physical ' +
      'resolution is not knowable from a web page.',
  };
}

export interface SystemSnapshot {
  userAgent: string;
  platform: string;
  vendor: string;
  language: string;
  languages: string;
  hardwareConcurrency: string;
  deviceMemory: string;
  maxTouchPoints: string;
  cookieEnabled: string;
  onLine: string;
  connection: string;
  effectiveType: string;
  downlink: string;
  uaFacts: UserAgentFacts;
  screenFacts: ScreenFacts;
}

export interface CollectSystemOptions {
  /** The live navigator, read through index access (it has no index signature). */
  navigator: object;
  screen?: ScreenFacts;
}

export function collectSystemSnapshot(options: CollectSystemOptions): SystemSnapshot {
  const nav = options.navigator as Record<string, unknown>;
  const maxTouchPoints = typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0;
  const ua = typeof nav.userAgent === 'string' ? nav.userAgent : '';
  const platform = typeof nav.platform === 'string' ? nav.platform : '';
  const conn = (nav.connection ?? {}) as { effectiveType?: string; downlink?: number; rtt?: number };
  const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined;
  const memory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const languages = Array.isArray(nav.languages) ? (nav.languages as string[]).join(', ') : '';

  return {
    userAgent: ua,
    platform: platform || 'Not exposed',
    vendor: typeof nav.vendor === 'string' && nav.vendor ? nav.vendor : 'Not exposed',
    language: typeof nav.language === 'string' && nav.language ? nav.language : 'Not exposed',
    languages: languages || 'Not exposed',
    hardwareConcurrency:
      typeof cores === 'number' && Number.isFinite(cores)
        ? `${cores} logical core${cores === 1 ? '' : 's'} reported by the browser (capped and often rounded down)`
        : 'Not exposed',
    deviceMemory:
      typeof memory === 'number' && Number.isFinite(memory)
        ? `≈ ${memory} GB (bucketed by the browser, rounded to a power of two)`
        : 'Not exposed',
    // A zero here is a real answer (no touch digitizer), not a missing value.
    maxTouchPoints: String(maxTouchPoints),
    cookieEnabled: nav.cookieEnabled === true ? 'Cookies enabled (accepting is permitted, not proof any cookie is set)' : 'Cookies disabled',
    onLine: nav.onLine === true ? 'Online' : nav.onLine === false ? 'Offline' : 'Not exposed',
    connection: conn.effectiveType ? String(conn.effectiveType).toUpperCase() : 'Network Information API not exposed',
    effectiveType: conn.effectiveType ? String(conn.effectiveType) : 'Not exposed',
    downlink:
      typeof conn.downlink === 'number' && Number.isFinite(conn.downlink)
        ? `≈ ${conn.downlink} Mbps${typeof conn.rtt === 'number' ? ` (estimated RTT ${conn.rtt} ms)` : ''} — estimate only`
        : 'Not exposed',
    uaFacts: parseUserAgentFacts(ua, platform, maxTouchPoints),
    screenFacts:
      options.screen ?? {
        screenWidth: 'Not exposed',
        screenHeight: 'Not exposed',
        availWidth: 'Not exposed',
        availHeight: 'Not exposed',
        colorDepth: 'Not exposed',
        viewportWidth: 'Not exposed',
        viewportHeight: 'Not exposed',
        devicePixelRatio: 'Not exposed',
        note: 'Window and screen values are unavailable.',
      },
  };
}

/**
 * The informational snapshot verdict. Deliberately 'measured', never 'passed':
 * reading a set of values is not a hardware diagnostic and cannot fail.
 */
export function summarizeSystemSnapshot(snapshot: SystemSnapshot): {
  status: 'measured';
  details: string;
  metrics: Record<string, number | boolean | string>;
} {
  return {
    status: 'measured',
    details:
      `Snapshot of what this browser exposes: ${snapshot.uaFacts.engine} (estimated from user agent), ` +
      `${snapshot.uaFacts.os}, ${snapshot.hardwareConcurrency.split(' ')[0]} logical core(s) reported, ` +
      `${snapshot.screenFacts.screenWidth} × ${snapshot.screenFacts.screenHeight} screen area, ` +
      `${snapshot.screenFacts.viewportWidth} × ${snapshot.screenFacts.viewportHeight} viewport. ` +
      'Nothing was tested here: this page reports values, it does not check whether any of them is healthy.',
    metrics: {
      screenWidthCssPx: numericOrUnset(snapshot.screenFacts.screenWidth),
      viewportWidthCssPx: numericOrUnset(snapshot.screenFacts.viewportWidth),
      maxTouchPoints: Number(snapshot.maxTouchPoints) || 0,
      logicalCoresReported: numericOrUnset(snapshot.hardwareConcurrency),
    },
  };
}

function numericOrUnset(value: string): number | string {
  const match = /^(\d+(?:\.\d+)?)/.exec(value);
  return match ? Number(match[1]) : 'not exposed';
}
