/**
 * Every localStorage key DeviceTry writes, in one dependency-free module.
 *
 * This file imports nothing on purpose: the storage inspector, the theme and
 * the three history writers all need these exact strings, and a shared source
 * of truth is what lets the inspector delete by ownership instead of by
 * substring. Importing React or any client module here would drag the whole
 * component tree into server and test contexts.
 */

export const THEME_STORAGE_KEY = 'devicetry-theme';
export const HISTORY_KEY = 'devicetry_test_history';
export const LOCAL_INSPECTIONS_KEY = 'devicetry_local_inspections';
export const COMPARE_STORAGE_KEY = 'devicetry_compare_v1';

/**
 * Fired on `window` whenever this site writes one of the keys above.
 *
 * The native `storage` event only fires in OTHER tabs, so a write in this tab
 * leaves every same-tab reader holding a stale view. The storage inspector
 * reads these keys to show what is actually stored, so a silent writer would
 * make it report a key as absent while it holds data — an inventory that
 * contradicts the browser. Every writer announces itself.
 */
export const STORAGE_CHANGE_EVENT = 'devicetry:storage-change';

/** Announce a same-tab write of an owned key. No-op outside a browser. */
export function notifyStorageChanged(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
}
