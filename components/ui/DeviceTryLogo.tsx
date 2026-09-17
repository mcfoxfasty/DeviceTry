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
        {/* Faint screen glow */}
        <rect x="7" y="8" width="26" height="19" rx="3.5" fill="#FFFFFF" fillOpacity="0.08" />
        {/* Device screen outline */}
        <rect x="7" y="8" width="26" height="19" rx="3.5" stroke="#FFFFFF" strokeWidth="2.25" fill="none" />
        {/* Device stand foot */}
        <path d="M20 27V31M15 31H25" stroke="#FFFFFF" strokeWidth="2.25" strokeLinecap="round" />
        {/* Diagnostic lens on the screen */}
        <circle cx="18.5" cy="16.5" r="5.2" stroke="#2DD4BF" strokeWidth="2.6" fill="none" />
        <path d="M22.4 20.4L26.6 24.6" stroke="#2DD4BF" strokeWidth="2.6" strokeLinecap="round" />
        {/* Lens glint */}
        <path d="M16.2 14.4C16.8 13.7 17.6 13.2 18.5 13.1" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
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
