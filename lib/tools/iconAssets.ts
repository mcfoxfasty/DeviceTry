/**
 * The supplied DeviceTry homepage icon assets, keyed by the canonical tool
 * slug. This is the single source of truth for PNG artwork in navigation and
 * tool surfaces; supporting diagnostics intentionally have no PNG mapping.
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
};

export function toolIconSrc(slug: string): string | null {
  const file = TOOL_ICON_FILES[slug];
  return file ? `/Icons/${file}` : null;
}
