'use client';

import React, { type ReactNode } from 'react';

/**
 * Accessible, mobile-safe table wrapper.
 *
 * Several testers rendered their result tables inside `overflow-hidden`
 * containers, which silently CLIPPED any column that did not fit a phone
 * screen — the user lost the value with no way to reach it. This wrapper
 * gives every table the same treatment:
 *
 *  - a real horizontal scroll container instead of clipping;
 *  - `role="region"` + `tabIndex={0}` + `aria-label` so the scroll area is
 *    reachable and operable by keyboard and screen-reader users (WCAG 2.1.1
 *    / 2.1.2 — content reachable by scrolling must be focusable);
 *  - a visible "swipe sideways" affordance on small screens only, hidden at
 *    `sm` and up where the table fits and no scrolling is needed, so the
 *    desktop presentation is unchanged;
 *  - a right-edge fade that marks the content as continuing.
 *
 * `maxHeight` adds a vertical scroll region for long result tables; pass it
 * only where the table can genuinely exceed the viewport height.
 */
export function ScrollableTable({
  children,
  label,
  maxHeight,
  className = '',
  minWidthClass = 'min-w-[560px]',
}: {
  children: ReactNode;
  /** Describes the table for assistive tech, e.g. "Codec support results". */
  label: string;
  /** Optional vertical cap, e.g. "max-h-[420px]". */
  maxHeight?: string;
  className?: string;
  /** Minimum table width before the container starts scrolling. */
  minWidthClass?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className={`overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl border border-[#DFE5EB] dark:border-[#223043] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14B8A6] ${
          maxHeight ? `${maxHeight} overflow-y-auto` : ''
        }`}
      >
        <div className={minWidthClass}>{children}</div>
      </div>

      {/* Mobile-only affordance: a small-screen table may still scroll
          horizontally, and a clipped-looking right edge is the main thing
          that made the old tables read as broken. */}
      <p className="sm:hidden mt-1.5 text-[10px] text-[#8996A6] dark:text-[#677589] flex items-center gap-1">
        <span aria-hidden="true">↔</span> Swipe the table sideways to see every column.
      </p>
    </div>
  );
}
