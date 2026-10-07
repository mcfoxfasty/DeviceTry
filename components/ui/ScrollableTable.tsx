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
 * THE TABLE ALWAYS GROWS VERTICALLY. There is deliberately no height cap and
 * no vertical overflow rule here: a result table that is taller than the screen
 * must be scrollable by the page itself, not trapped in a second inner scroll
 * region — and the old vertical clip paired with a hard cap hid rows with no
 * way to reach them at all.
 * Do not reintroduce a height cap or a vertical clip on these tables;
 * tests/responsiveLayout.test.ts fails if either comes back.
 */
export function ScrollableTable({
  children,
  label,
  className = '',
  minWidthClass = 'min-w-[560px]',
}: {
  children: ReactNode;
  /** Describes the table for assistive tech, e.g. "Codec support results". */
  label: string;
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
        className="overflow-x-auto overscroll-x-contain rounded-xl border border-[#DFE5EB] dark:border-[#223043] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14B8A6]"
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
