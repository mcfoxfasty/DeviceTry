'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';

/** Show the control only once the user has meaningfully left the top. */
const VISIBILITY_THRESHOLD = 420;

export function BackToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const previousPathRef = useRef<string | null>(null);
  const restoringHistoryRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener('change', updateMotion);
    return () => media.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY >= VISIBILITY_THRESHOLD);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, []);

  useEffect(() => {
    const markHistoryNavigation = () => {
      restoringHistoryRef.current = true;
    };
    window.addEventListener('popstate', markHistoryNavigation);
    return () => window.removeEventListener('popstate', markHistoryNavigation);
  }, []);

  // Next's client router normally resets client-side pushes, but an initial
  // load can still inherit a stale browser-restored offset. Reset the initial
  // document and genuinely new pathnames only. Hash links remain untouched,
  // while Back/Forward stays browser-owned and restores its prior offset.
  useEffect(() => {
    const isNewDocumentOrPath =
      previousPathRef.current === null || previousPathRef.current !== pathname;
    if (
      isNewDocumentOrPath &&
      !restoringHistoryRef.current &&
      !window.location.hash
    ) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    previousPathRef.current = pathname;
    restoringHistoryRef.current = false;
  }, [pathname]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={scrollToTop}
      className={`no-print fixed bottom-5 right-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#0F766E]/30 bg-white/95 text-[#0F766E] shadow-lg shadow-[#0F766E]/15 backdrop-blur transition-[opacity,transform,background-color] hover:bg-[#E6F4F2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F766E]/40 dark:border-[#14B8A6]/40 dark:bg-[#132E2E]/95 dark:text-[#5EEAD4] dark:hover:bg-[#16403D] dark:focus-visible:ring-[#14B8A6]/50 sm:bottom-7 sm:right-7 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
