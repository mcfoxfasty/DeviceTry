import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  /** 'light' renders the wordmark for dark backgrounds (e.g. footer). */
  variant?: 'default' | 'light';
}

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
      >
        {/* Rounded badge backdrop */}
        <rect width="40" height="40" rx="10" fill="#0F766E" />
        {/* Device screen outline */}
        <rect x="8.5" y="10.5" width="23" height="16" rx="3" stroke="#FFFFFF" strokeWidth="2" fill="none" />
        {/* Device stand foot */}
        <path d="M20 26.5V30M15.5 30H24.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        {/* Diagnostic loop on the screen */}
        <g
          transform="translate(14 12.5) scale(0.5)"
          stroke="#2DD4BF"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </g>
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
