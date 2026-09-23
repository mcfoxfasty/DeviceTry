'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Share2, Copy, Check, ChevronDown, X } from 'lucide-react';
import { SharePayload, ShareTarget, shareTargetsFor } from '@/lib/share';

const subscribeNoop = () => () => {};

interface ShareButtonProps {
  payload: SharePayload;
  url: string;
  /** Accessible name; defaults to the payload-derived label. */
  label?: string;
  className?: string;
}

/**
 * Reusable share control (post-deployment correction C).
 *
 * - Web Share API first when available (single native sheet, no SDKs).
 * - Otherwise a small fallback menu: WhatsApp, Facebook, X, LinkedIn,
 *   Copy Link. These are plain outbound links to first-party share
 *   endpoints — no social SDKs are loaded, so no tracker scripts run.
 * - Only an already-safe payload reaches this component (see lib/share.ts);
 *   nothing media/IP/keys/clipboard-related is ever included.
 */
export function ShareButton({ payload, url, label, className }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Web Share availability is browser state, not React state: read it with
  // useSyncExternalStore so the first client render matches SSR (false) and
  // the real value appears in one non-cascading pass.
  const supportsWebShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false
  );

  // Close on outside click / Escape.
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

  const shareText = `${payload.text} ${url}`;

  const onShare = useCallback(
    async (target: ShareTarget) => {
      setOpen(false);
      if (target.id === 'copy') {
        try {
          await navigator.clipboard.writeText(shareText);
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
    [shareText]
  );

  const onPrimary = useCallback(async () => {
    if (supportsWebShare) {
      try {
        await navigator.share({ title: 'DeviceTry', text: payload.text, url });
        return;
      } catch {
        // User dismissed the sheet — do not fall back on dismissal.
        return;
      }
    }
    setOpen((v) => !v);
  }, [supportsWebShare, payload.text, url]);

  const targets = shareTargetsFor(payload.text, url).filter(
    (t) => !(t.id === 'system') && !(t.id === 'copy' && supportsWebShare)
  );

  const triggerLabel =
    label ?? (payload.includesScore ? 'Share your score' : 'Share this result');

  return (
    <div ref={rootRef} className={`relative inline-block ${className ?? ''}`}>
      <button
        type="button"
        onClick={onPrimary}
        aria-haspopup={supportsWebShare ? undefined : 'menu'}
        aria-expanded={supportsWebShare ? undefined : open}
        aria-label={triggerLabel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[#142033] dark:text-[#E9EEF4] hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors cursor-pointer no-print"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
        {copied ? 'Link copied' : triggerLabel}
        {!supportsWebShare && !copied && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={triggerLabel}
          className="absolute right-0 bottom-full mb-2 z-20 w-44 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] shadow-lg overflow-hidden"
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
      )}
    </div>
  );
}

export default ShareButton;
