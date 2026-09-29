/**
 * The supplied DeviceTry icon assets, keyed by the canonical tool slug. This
 * is the single source of truth for PNG artwork in navigation and tool
 * surfaces. A slug with no entry here keeps the original SVG artwork from
 * ToolIcon — Permission Diagnostics is the one supporting diagnostic that
 * does, because it is the only one without supplied PNG artwork.
 *
 * Every mapped file MUST exist under public/Icons/. tests/iconAssets.test.ts
 * fails the build if one is missing, because a mapping without its file
 * renders as a broken image on the tool surface that uses it.
 */
export const TOOL_ICON_FILES: Record<string, string> = {
  'microphone-test': 'microphone-test.png',
  'webcam-test': 'webcam-test.png',
  'speakers-test': 'speakers-test.png',
  'voice-recorder': 'voice-recorder.png',
  'tone-generator': 'tone-generator.png',
  'keyboard-test': 'keyboard-test.png',
  'mouse-test': 'mouse-test.png',
  'gamepad-test': 'gamepad-test.png',
  'touchscreen-test': 'touchscreen-test.png',
  'click-speed-test': 'click-speed-test.png',
  'reaction-time-test': 'reaction-time-test.png',
  'screen-test': 'screen-test.png',
  'refresh-rate-test': 'refresh-rate-test.png',
  'internet-speed-test': 'internet-speed-test.png',
  'what-is-my-ip': 'what-is-my-ip.png',
  // Supporting diagnostics (see /advanced-diagnostics).
  'browser-compatibility': 'browser-compatibility.png',
  'codec-support': 'codec-support.png',
  'webrtc-test': 'webrtc-test.png',
  'browser-system-info': 'browser-system-info.png',
  'devicetry-storage-inspector': 'devicetry-storage-inspector.png',
};

export function toolIconSrc(slug: string): string | null {
  const file = TOOL_ICON_FILES[slug];
  return file ? `/Icons/${file}` : null;
}
