import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  /** 'light' renders the wordmark for dark backgrounds (e.g. footer). */
  variant?: 'default' | 'light';
}

/**
 * DeviceTry brand mark: a glossy blue rounded badge with a white magnifying
 * glass whose lens contains a checkmark — "test your device, get a verdict".
 * Original SVG artwork recreating the supplied reference; no external assets.
 * Scales cleanly from the 26px mobile header up to favicons-sized usage.
 */
export function DeviceTryLogo({ className = '', size = 36, showText = true, variant = 'default' }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
        role="presentation"
        focusable="false"
      >
        <defs>
          {/* Badge body: deep blue core, brighter toward the top-right. */}
          <linearGradient id="dtLogoBody" x1="6" y1="34" x2="34" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0B4FD9" />
            <stop offset="0.45" stopColor="#1565E8" />
            <stop offset="1" stopColor="#2E8BFF" />
          </linearGradient>
          {/* Cyan glow pooling in the top-right and bottom-left corners. */}
          <radialGradient id="dtLogoGlowTR" cx="0.85" cy="0.1" r="0.75">
            <stop offset="0" stopColor="#43E8EC" stopOpacity="0.9" />
            <stop offset="0.55" stopColor="#38D6EA" stopOpacity="0.35" />
            <stop offset="1" stopColor="#38D6EA" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dtLogoGlowBL" cx="0.12" cy="0.92" r="0.7">
            <stop offset="0" stopColor="#43E8EC" stopOpacity="0.65" />
            <stop offset="0.6" stopColor="#38D6EA" stopOpacity="0.2" />
            <stop offset="1" stopColor="#38D6EA" stopOpacity="0" />
          </radialGradient>
          {/* Glass sheen across the upper face. */}
          <linearGradient id="dtLogoSheen" x1="20" y1="2.5" x2="20" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
            <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <clipPath id="dtLogoClip">
            <rect x="0" y="0" width="40" height="40" rx="10.5" />
          </clipPath>
        </defs>

        {/* Rounded glossy badge */}
        <g clipPath="url(#dtLogoClip)">
          <rect x="0" y="0" width="40" height="40" rx="10.5" fill="url(#dtLogoBody)" />
          <rect x="0" y="0" width="40" height="40" rx="10.5" fill="url(#dtLogoGlowTR)" />
          <rect x="0" y="0" width="40" height="40" rx="10.5" fill="url(#dtLogoGlowBL)" />
          <path
            d="M3.5 15.5C9 10.5 15 8 22 8c6 0 10.5 1.6 14.5 4.2V3.8C33.4 2.4 28 2 20 2 12 2 6.6 2.4 3.5 3.8Z"
            fill="url(#dtLogoSheen)"
          />
        </g>
        {/* Inner rim light + soft outer edge */}
        <rect x="1" y="1" width="38" height="38" rx="9.5" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
        <rect x="0.5" y="0.5" width="39" height="39" rx="10" stroke="#0A3FAE" strokeOpacity="0.5" strokeWidth="1" fill="none" />

        {/* Magnifying glass: ring, glint, checkmark, handle */}
        <circle cx="17.6" cy="17.2" r="7.1" stroke="#FFFFFF" strokeWidth="3.2" fill="#FFFFFF" fillOpacity="0.05" />
        <path
          d="M12.9 13.9c1-1.3 2.5-2.1 4.2-2.2"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M14 17.4l2.7 2.6 4.9-5.2"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M22.8 22.4l7.4 7.4"
          stroke="#FFFFFF"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        {/* Handle base connection for optical continuity */}
        <circle cx="22.8" cy="22.4" r="1.2" fill="#FFFFFF" opacity="0.9" />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-extrabold text-lg sm:text-xl tracking-tight ${
                variant === 'light' ? 'text-[#E9F2F4]' : 'text-[#172033] dark:text-[#E9EEF4]'
              }`}
            >
              Device<span className="text-[#0F766E] dark:text-[#14B8A6]">Try</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
