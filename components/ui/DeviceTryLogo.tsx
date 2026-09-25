import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  /**
   * Wordmark type size in px. The mark is derived from it (see
   * MARK_HEIGHT_RATIO) so the icon and the wordmark can never drift out of
   * proportion at any call site.
   */
  size?: number;
  showText?: boolean;
  /** 'light' is for permanently dark surfaces such as the footer. */
  variant?: 'default' | 'light';
}

/**
 * Brand colours. The green is sampled from the supplied artwork in
 * `public/Logo.png` (dominant check tone: rgb(126, 217, 87)); the navy is the
 * wordmark ink used across the light surfaces, and the outline of the mark is
 * re-inked to match it so the lockup reads as one colour system.
 */
export const DEVICE_TRY_GREEN = '#7ED957';
export const DEVICE_TRY_NAVY = '#0E1B2E';

/** Screen + check artwork, trimmed to its ink: 1536 x 1010 px. */
const MARK_ASPECT = 1536 / 1010;
const DEVICE_TRY_LOGO_SRC = '/brand/devicetry-logo.png';
const DEVICE_TRY_LOGO_SRC_LIGHT = '/brand/devicetry-logo-light.png';

/**
 * Optical balance. Plus Jakarta Sans has a cap height of ~0.73em, so the mark
 * is sized at 1.12x cap height (0.82em). The mark is a wide, low shape, so
 * anything taller reads as a competing second headline next to the wordmark.
 */
const MARK_HEIGHT_RATIO = 0.82;

/**
 * The mark is generated from the untouched source file `public/Logo.png`:
 * padding trimmed, background made transparent, and a light-ink copy for dark
 * surfaces (the brand green check is kept in both). The lockup sits on one
 * line with the wordmark: the mark's bottom edge rides the text baseline
 * (`items-baseline`), which anchors both parts optically without a magic
 * nudge, and the wordmark runs in a tight `leading-none` box so the two never
 * look vertically offset.
 */
export function DeviceTryLogo({ className = '', size = 19, showText = true, variant = 'default' }: LogoProps) {
  const markHeight = Math.max(1, Math.round(size * MARK_HEIGHT_RATIO));
  const markWidth = Math.round(markHeight * MARK_ASPECT);
  // The mark is decorative: the link that wraps it already carries the name.
  const mark = {
    width: markWidth,
    height: markHeight,
    draggable: false,
    unoptimized: true,
  };
  const wordmark = variant === 'light' ? 'text-[#F0F5F4]' : 'text-[#0E1B2E] dark:text-[#F0F5F4]';

  return (
    <span
      className={`inline-flex items-baseline ${className}`}
      style={{ gap: Math.round(size * 0.28) }}
    >
      {variant === 'light' ? (
        <Image src={DEVICE_TRY_LOGO_SRC_LIGHT} {...mark} alt="" aria-hidden="true" className="shrink-0 select-none" />
      ) : (
        <>
          {/* The theme class decides which ink is legible in the header. */}
          <Image src={DEVICE_TRY_LOGO_SRC} {...mark} alt="" aria-hidden="true" className="shrink-0 select-none dark:hidden" />
          <Image src={DEVICE_TRY_LOGO_SRC_LIGHT} {...mark} alt="" aria-hidden="true" className="hidden shrink-0 select-none dark:block" />
        </>
      )}
      {showText && (
        <span
          className={`font-semibold leading-none tracking-[-0.02em] whitespace-nowrap ${wordmark}`}
          style={{
            fontSize: size,
            fontFamily: 'var(--font-brand), ui-sans-serif, system-ui, sans-serif',
          }}
        >
          Device<span style={{ color: DEVICE_TRY_GREEN }}>Try</span>
        </span>
      )}
    </span>
  );
}
