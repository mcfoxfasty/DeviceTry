'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Share2, Copy, Check, ChevronDown, X } from 'lucide-react';
import { SITE_URL } from '@/lib/site';
import { ShareTarget, shareTargetsFor } from '@/lib/share';

const subscribeNoop = () => () => {};

/** Generic, public-only site share text — never test results or private data. */
const SITE_SHARE_TEXT =
  'DeviceTry — free browser-based hardware tests for your microphone, camera, keyboard, screen, and more.';

interface ShareSiteButtonProps {
  /** "row" = full-width navigation row (drawers); "link" = inline text link (footer). */
  variant?: 'row' | 'link';
  /** Visible + accessible label (from the active dictionary). */
  label: string;
  /** Called after the native share sheet completes (e.g. to close the drawer). */
  onShared?: () => void;
}

/**
 * "Share DeviceTry" navigation item — site-level sharing, deliberately
 * separate from result sharing (components/ui/ShareButton.tsx):
 *
 * - Web Share API first when available (single native sheet, no SDKs).
 * - Otherwise the same fallback menu as result sharing: WhatsApp, Facebook,
 *   X, LinkedIn, Copy Link — plain outbound links built by lib/share.ts.
 * - The payload is ALWAYS the public site URL (lib/site.ts) and a generic
 *   site title. No test results, media, IP addresses, keys, clipboard
 *   content, or identifiers are ever included.
 */
export function ShareSiteButton({ variant = 'row', label, onShared }: ShareSiteButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Same hydration-safe pattern as ShareButton: server snapshot is false so
  // the first client render matches SSR; the real value arrives in one pass.
  const supportsWebShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false
  );

  // Close the fallback menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onShare = useCallback(
    async (target: ShareTarget) => {
      setOpen(false);
      if (target.id === 'copy') {
        try {
          await navigator.clipboard.writeText(`${SITE_SHARE_TEXT} ${SITE_URL}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
        return;
      }
      if (target.external) {
        window.open(target.href, '_blank', 'noopener,noreferrer');
      }
    },
    []
  );

  const onPrimary = useCallback(async () => {
    if (supportsWebShare) {
      try {
        await navigator.share({ title: 'DeviceTry', text: SITE_SHARE_TEXT, url: SITE_URL });
        onShared?.();
        return;
      } catch {
        // User dismissed the native sheet — do not fall back on dismissal.
        return;
      }
    }
    setOpen((v) => !v);
  }, [supportsWebShare, onShared]);

  const targets = shareTargetsFor(SITE_SHARE_TEXT, SITE_URL).filter(
    (t) => t.id !== 'system' && !(t.id === 'copy' && supportsWebShare)
  );

  const menu = open && (
    <div
      role="menu"
      aria-label={label}
      className="absolute bottom-full mb-2 z-30 w-44 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] shadow-lg overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#DFE5EB] dark:border-[#223043]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8996A6]">Share via</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close share menu"
          className="text-[#8996A6] hover:text-[#142033] dark:hover:text-[#E9EEF4] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {targets.map((t) => (
        <button
          key={t.id}
          type="button"
          role="menuitem"
          onClick={() => onShare(t)}
          className="w-full text-left px-3 py-2.5 text-xs font-semibold text-[#142033] dark:text-[#E9EEF4] hover:bg-[#F6F7F9] dark:hover:bg-[#192332] transition-colors cursor-pointer"
        >
          {t.id === 'copy' ? (
            <span className="inline-flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 opacity-70" /> {t.label}
            </span>
          ) : (
            t.label
          )}
        </button>
      ))}
    </div>
  );

  if (variant === 'link') {
    // Footer: visually consistent with the other footer links (text-xs).
    return (
      <div ref={rootRef} className="relative inline-block">
        <button
          type="button"
          onClick={onPrimary}
          aria-haspopup={supportsWebShare ? undefined : 'menu'}
          aria-expanded={supportsWebShare ? undefined : open}
          className="inline-flex items-center gap-1.5 cursor-pointer hover:text-[#2DD4BF] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#2DD4BF]" /> : <Share2 className="w-3.5 h-3.5" />}
          {copied ? 'Link copied' : label}
          {!supportsWebShare && !copied && <ChevronDown className="w-3 h-3 opacity-60" />}
        </button>
        {menu}
      </div>
    );
  }

  // Drawer row: same geometry as DRAWER_LINKS rows (icon + label, ≥44px tap).
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={onPrimary}
        aria-haspopup={supportsWebShare ? undefined : 'menu'}
        aria-expanded={supportsWebShare ? undefined : open}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] hover:bg-[#F4F2FA] dark:hover:bg-[#192332] transition-colors cursor-pointer"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />}
        {copied ? 'Link copied' : label}
        {!supportsWebShare && !copied && <ChevronDown className="w-3 h-3 ml-auto opacity-60" />}
      </button>
      {menu}
    </div>
  );
}

export default ShareSiteButton;
