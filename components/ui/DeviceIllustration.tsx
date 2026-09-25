import React from 'react';

interface DeviceIllustrationProps {
  type: string;
  className?: string;
  size?: number;
}

export function DeviceIllustration({ type, className = '', size = 64 }: DeviceIllustrationProps) {
  const s = size;

  switch (type) {
    case 'microphone':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          {/* Base glow/accent */}
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#0F766E]/10 dark:fill-[#14B8A6]/15" />
          {/* Stand */}
          <path d="M32 44V54M22 54H42" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Cradle U-shape */}
          <path d="M20 26C20 32.6274 25.3726 38 32 38C38.6274 38 44 32.6274 44 26" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" />
          {/* Capsule body */}
          <rect x="25" y="14" width="14" height="20" rx="7" fill="#0F766E" className="dark:fill-[#14B8A6]" />
          {/* Grille lines */}
          <line x1="28" y1="20" x2="36" y2="20" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="28" y1="24" x2="36" y2="24" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          {/* Waveform arcs */}
          <path d="M14 26C14 20 18 16 20 15" stroke="#14B8A6" strokeWidth="1.75" strokeLinecap="round" opacity="0.8" />
          <path d="M50 26C50 20 46 16 44 15" stroke="#14B8A6" strokeWidth="1.75" strokeLinecap="round" opacity="0.8" />
        </svg>
      );

    case 'webcam':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#0F766E]/10 dark:fill-[#14B8A6]/15" />
          {/* Base clamp */}
          <path d="M22 52H42M32 44V52M18 48C24 44 40 44 46 48" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Camera body capsule */}
          <rect x="16" y="18" width="32" height="22" rx="11" fill="#0F766E" className="dark:fill-[#14B8A6]" />
          {/* Outer lens ring */}
          <circle cx="32" cy="29" r="8" fill="#172033" stroke="#FFFFFF" strokeWidth="2" />
          {/* Inner glass aperture */}
          <circle cx="32" cy="29" r="4" fill="#0F766E" />
          {/* Lens reflection light */}
          <circle cx="34" cy="27" r="1.5" fill="#FFFFFF" />
          {/* Status LED */}
          <circle cx="42" cy="24" r="1.5" fill="#10B981" />
        </svg>
      );

    case 'monitor':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#2563EB]/10 dark:fill-[#3B82F6]/15" />
          {/* Monitor frame */}
          <rect x="14" y="15" width="36" height="26" rx="4" stroke="#2563EB" strokeWidth="2.5" fill="#FFFFFF" className="dark:fill-[#111D30]" />
          {/* Screen content area */}
          <rect x="17" y="18" width="30" height="20" rx="2" fill="#2563EB" fillOpacity="0.15" />
          {/* Test pattern bars on screen */}
          <rect x="20" y="21" width="4" height="14" fill="#EF4444" />
          <rect x="25" y="21" width="4" height="14" fill="#10B981" />
          <rect x="30" y="21" width="4" height="14" fill="#3B82F6" />
          <rect x="35" y="21" width="4" height="14" fill="#F59E0B" />
          <rect x="40" y="21" width="4" height="14" fill="#8B5CF6" />
          {/* Stand leg & base */}
          <path d="M32 41V49M24 49H40" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'keyboard':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#7C3AED]/10 dark:fill-[#8B5CF6]/15" />
          {/* Keyboard chassis */}
          <rect x="12" y="20" width="40" height="26" rx="5" stroke="#7C3AED" strokeWidth="2.5" fill="#FFFFFF" className="dark:fill-[#111D30]" />
          {/* Key row 1 */}
          <rect x="16" y="24" width="5" height="4" rx="1" fill="#7C3AED" />
          <rect x="23" y="24" width="5" height="4" rx="1" fill="#7C3AED" />
          <rect x="30" y="24" width="5" height="4" rx="1" fill="#7C3AED" />
          <rect x="37" y="24" width="5" height="4" rx="1" fill="#7C3AED" />
          <rect x="44" y="24" width="4" height="4" rx="1" fill="#7C3AED" />
          {/* Key row 2 */}
          <rect x="16" y="30" width="6" height="4" rx="1" fill="#7C3AED" />
          <rect x="24" y="30" width="5" height="4" rx="1" fill="#7C3AED" />
          <rect x="31" y="30" width="5" height="4" rx="1" fill="#8B5CF6" />
          <rect x="38" y="30" width="5" height="4" rx="1" fill="#7C3AED" />
          <rect x="45" y="30" width="3" height="4" rx="1" fill="#7C3AED" />
          {/* Spacebar row */}
          <rect x="22" y="36" width="20" height="4" rx="1" fill="#7C3AED" className="dark:fill-[#8B5CF6]" />
        </svg>
      );

    case 'mouse':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#7C3AED]/10 dark:fill-[#8B5CF6]/15" />
          {/* Mouse body */}
          <rect x="20" y="16" width="24" height="34" rx="12" stroke="#7C3AED" strokeWidth="2.5" fill="#FFFFFF" className="dark:fill-[#111D30]" />
          {/* Divider line */}
          <line x1="32" y1="16" x2="32" y2="30" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
          <line x1="20" y1="30" x2="44" y2="30" stroke="#7C3AED" strokeWidth="2" />
          {/* Scroll wheel */}
          <rect x="30" y="20" width="4" height="7" rx="2" fill="#7C3AED" className="dark:fill-[#8B5CF6]" />
        </svg>
      );

    case 'headphones':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#0F766E]/10 dark:fill-[#14B8A6]/15" />
          {/* Headband arch */}
          <path d="M18 36V30C18 22.268 24.268 16 32 16C39.732 16 46 22.268 46 30V36" stroke="#0F766E" strokeWidth="2.75" strokeLinecap="round" />
          {/* Left earpad */}
          <rect x="14" y="32" width="8" height="16" rx="4" fill="#0F766E" className="dark:fill-[#14B8A6]" />
          {/* Right earpad */}
          <rect x="42" y="32" width="8" height="16" rx="4" fill="#0F766E" className="dark:fill-[#14B8A6]" />
          {/* Sound waves */}
          <path d="M26 38C28 40 28 42 26 44" stroke="#14B8A6" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M38 38C36 40 36 42 38 44" stroke="#14B8A6" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case 'gamepad':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#7C3AED]/10 dark:fill-[#8B5CF6]/15" />
          {/* Controller outline */}
          <path
            d="M16 25C20 20 44 20 48 25C52 30 50 46 44 46C40 46 38 40 32 40C26 40 24 46 20 46C14 46 12 30 16 25Z"
            stroke="#7C3AED"
            strokeWidth="2.5"
            fill="#FFFFFF"
            className="dark:fill-[#111D30]"
          />
          {/* D-Pad */}
          <rect x="21" y="28" width="3" height="7" rx="0.5" fill="#7C3AED" />
          <rect x="19" y="30" width="7" height="3" rx="0.5" fill="#7C3AED" />
          {/* Action buttons (ABXY) */}
          <circle cx="43" cy="28" r="1.5" fill="#EF4444" />
          <circle cx="46" cy="31" r="1.5" fill="#3B82F6" />
          <circle cx="40" cy="31" r="1.5" fill="#10B981" />
          <circle cx="43" cy="34" r="1.5" fill="#F59E0B" />
          {/* Thumbsticks */}
          <circle cx="27" cy="36" r="3" stroke="#7C3AED" strokeWidth="1.5" fill="#8B5CF6" />
          <circle cx="37" cy="36" r="3" stroke="#7C3AED" strokeWidth="1.5" fill="#8B5CF6" />
        </svg>
      );

    case 'touch-phone':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#D97706]/10 dark:fill-[#F59E0B]/15" />
          {/* Phone body */}
          <rect x="20" y="14" width="24" height="36" rx="5" stroke="#D97706" strokeWidth="2.5" fill="#FFFFFF" className="dark:fill-[#111D30]" />
          {/* Screen area */}
          <rect x="23" y="18" width="18" height="26" rx="2" fill="#D97706" fillOpacity="0.12" />
          {/* Touch indicator circles */}
          <circle cx="28" cy="27" r="3" fill="#10B981" />
          <circle cx="36" cy="34" r="3" fill="#3B82F6" />
          {/* Speaker slit */}
          <line x1="29" y1="16" x2="35" y2="16" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'sensor-phone':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#D97706]/10 dark:fill-[#F59E0B]/15" />
          {/* Tilted phone */}
          <rect
            x="20"
            y="14"
            width="24"
            height="36"
            rx="5"
            stroke="#D97706"
            strokeWidth="2.5"
            fill="#FFFFFF"
            className="dark:fill-[#111D30]"
            transform="rotate(6 32 32)"
          />
          {/* Coordinate axis arrows */}
          <path d="M32 20V44M32 20L29 23M32 20L35 23" stroke="#2563EB" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 32H44M44 32L41 29M44 32L41 35" stroke="#EF4444" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'gauge':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#0284C7]/10 dark:fill-[#38BDF8]/15" />
          {/* Gauge dial */}
          <path d="M16 38C16 27.5066 24.5066 19 35 19C45.4934 19 54 27.5066 54 38" transform="translate(-3 -3)" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
          {/* Colored speed zones */}
          <path d="M18 36C18 27.7157 24.7157 21 33 21" transform="translate(-3 -3)" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M30 18.6C31 18.2 32 18 33 18" transform="translate(-3 -3)" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          {/* Needle */}
          <line x1="30" y1="35" x2="41" y2="22" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="30" cy="35" r="2.5" fill="#0284C7" className="dark:fill-[#38BDF8]" />
          {/* Speed lines below */}
          <path d="M22 46H42" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" opacity="0.5" className="dark:stroke-[#38BDF8]" />
          <path d="M26 51H38" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" opacity="0.3" className="dark:stroke-[#38BDF8]" />
        </svg>
      );

    default:
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="8" y="8" width="48" height="48" rx="12" className="fill-[#0F766E]/10 dark:fill-[#14B8A6]/15" />
          <rect x="16" y="16" width="32" height="32" rx="6" stroke="#0F766E" strokeWidth="2.5" fill="#FFFFFF" className="dark:fill-[#111D30]" />
          <path d="M24 32L30 38L40 26" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
