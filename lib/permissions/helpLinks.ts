/**
 * Official OS help links for "I blocked the site at device level".
 *
 * Both of these were real, user-facing problems. The Windows link was a
 * fabricated GUID-shaped support.microsoft.com path (it 404s), and the Apple
 * link pointed at the retired HT210192 article (also 404). A help link that
 * goes nowhere is worse than no link: the reader is already blocked and the
 * page sends them to a dead end.
 *
 * The URLs below are the current official pages, chosen because they are the
 * ones that actually cover camera and microphone app permissions:
 *  - Microsoft: "Windows camera, microphone, and privacy" (applies to Windows
 *    10 and 11), which walks through Settings > Privacy & security > Camera
 *    and > Microphone.
 *  - Apple: the Mac User Guide page "Change Privacy & Security settings on
 *    Mac", which covers every Privacy & Security pane including Camera and
 *    Microphone.
 *
 * They live here so the permission card and the permission-denied modal
 * cannot drift apart again.
 */

/** Microsoft's Windows camera/microphone privacy support page. */
export const WINDOWS_CAMERA_MICROPHONE_PRIVACY_URL =
  'https://support.microsoft.com/en-us/windows/privacy/windows-camera-microphone-and-privacy';

/** Apple's Mac User Guide page for Privacy & Security settings. */
export const APPLE_PRIVACY_SETTINGS_URL =
  'https://support.apple.com/en-us/guide/mac-help/change-privacy-security-settings-mchl211c911f/mac';

/** Hosts these links are allowed to point at. */
export const PERMISSION_HELP_HOSTS = ['support.microsoft.com', 'support.apple.com'] as const;

/** True when a help URL is an official vendor support page, not a lookalike. */
export function isOfficialPermissionHelpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:') return false;
    return (PERMISSION_HELP_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}