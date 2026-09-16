import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function DeviceTryLogo({ className = '', size = 36, showText = true }: LogoProps) {
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
        <rect x="8" y="9" width="24" height="18" rx="3" stroke="#FFFFFF" strokeWidth="2" fill="none" />
        {/* Device stand foot */}
        <path d="M20 27V31M14 31H26" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        {/* Prominent verify checkmark inside screen */}
        <path
          d="M13 18L18 23L27 14"
          stroke="#14B8A6"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#172033] dark:text-[#E9EEF4]">
              Device<span className="text-[#0F766E] dark:text-[#14B8A6]">Try</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
