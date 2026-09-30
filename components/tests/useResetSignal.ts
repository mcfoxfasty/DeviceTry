'use client';

import { useEffect, useRef } from 'react';

/**
 * Fires `onReset` whenever the HOST clears the shared result banner.
 *
 * Why this exists: the banner's "Clear result" button resets the shared
 * controller directly. Without a signal, a tester keeps its own visible
 * output — the cards, tables and figures describing a run the user just
 * cancelled — so the page contradicts itself after a clear.
 *
 * `resetSignal` is a counter the wrapper increments on every host reset. It is
 * compared against the value seen at mount, so the first render never fires
 * the callback (a page that queries on load must still do so); only a real
 * clear afterwards triggers it. The callback is read from a ref, so it can be
 * a fresh closure on every render without re-triggering the effect.
 */
export function useResetPulse(resetSignal: number | undefined, onReset: () => void): void {
  const firstSeen = useRef(resetSignal);
  const handler = useRef(onReset);

  // Synced in an effect rather than during render: writing a ref while
  // rendering is a render-phase side effect, and the value it holds would be
  // from the current commit only by luck of ordering. Effects declared in the
  // same component run in declaration order, so this sync always completes
  // before the pulse effect below reads the ref.
  useEffect(() => {
    handler.current = onReset;
  });

  useEffect(() => {
    if (firstSeen.current === resetSignal) return;
    handler.current();
  }, [resetSignal]);
}
