'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

/**
 * Theme handling (Phase 10 corrections):
 *
 * - Light is the DEFAULT for every visitor; device dark preference no longer
 *   forces the site dark.
 * - The stored choice lives in localStorage('devicetry-theme') as 'light' | 'dark'.
 * - app/layout.tsx runs a tiny inline script BEFORE first paint that applies
 *   the stored choice to <html class="dark">, so the initial render is stable
 *   and hydration-safe without any suppressHydrationWarning.
 *
 * React reads the theme through useSyncExternalStore: the <html> class is the
 * external source of truth, and the store notifies subscribers when setTheme
 * flips it. This avoids cascading setState-in-effect renders entirely.
 */

export type ThemeChoice = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'devicetry-theme';

/** Shape the layout's inline script injects (kept in sync manually). */
export const THEME_INIT_SNIPPET = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='dark'||s==='light'){document.documentElement.classList.toggle('dark',s==='dark');}}catch(e){}})();`;

/** Inline script element for the root layout (renders nothing itself). */
export function ThemeInitScript() {
  return <script key="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SNIPPET }} />;
}

/* ---------------- external store: the <html> class ---------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readDomTheme(): ThemeChoice {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(next: ThemeChoice) {
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage unavailable (private mode) — theme still applies for this visit.
  }
  for (const listener of listeners) listener();
}

/* ---------------- hydration marker ---------------- */

const noopSubscribe = () => () => {};

/* ---------------- context ---------------- */

interface ThemeContextValue {
  /** The active theme; resolves to the stored choice after hydration. */
  theme: ThemeChoice;
  /** True once rendering on the client (post-hydration). */
  ready: boolean;
  setTheme: (t: ThemeChoice) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  ready: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readDomTheme, () => 'light' as ThemeChoice);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const setTheme = useCallback((next: ThemeChoice) => applyTheme(next), []);
  const toggleTheme = useCallback(() => {
    applyTheme(readDomTheme() === 'dark' ? 'light' : 'dark');
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, ready, setTheme, toggleTheme }),
    [theme, ready, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
