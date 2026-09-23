/**
 * Mobile/virtual-keyboard honesty helpers (post-deployment correction E).
 *
 * An on-screen (virtual) keyboard or IME generates synthetic key events —
 * most recognizably keyCode 229 — that prove nothing about a PHYSICAL
 * keyboard's keys or layout. These helpers let the keyboard tester accept
 * virtual typing into a clearly separate check while guaranteeing that
 * virtual input can never produce a full keyboard-test pass.
 */

/** KeyDownEvent-like subset used for classification (keeps this unit-testable). */
export interface KeyEventLike {
  keyCode?: number;
  isComposing?: boolean;
  key?: string;
}

/** True when the event originates from an on-screen keyboard / IME composition. */
export function isVirtualKeyboardKey(e: KeyEventLike): boolean {
  return e.keyCode === 229 || e.isComposing === true;
}

/** Notice rendered on touch-first devices (no physical keyboard assumed). */
export const TOUCH_DEVICE_NOTICE =
  'This device appears to be touch-only. The full keyboard test needs a physical keyboard — ' +
  'connect one over Bluetooth or USB, or open this page on a desktop. Typing on the on-screen ' +
  'keyboard only runs the separate virtual typing check below; it can never verify physical ' +
  'keys or your layout.';

/** Caption for the separate virtual-typing check. */
export const VIRTUAL_TYPING_NOTICE =
  'Virtual keyboard typing check — this only confirms that on-screen typing produces input ' +
  'events. It is not a physical keyboard test and never produces a keyboard pass.';
