import React from 'react';

/**
 * Phase 10 original SVG icon family.
 *
 * A compact, geometric icon set inspired by the clarity of iLovePDF's tool
 * cards — NOT a copy of their paths, symbols, or branding. One recognizable
 * visual idea per tool, consistent 24-unit viewBox and optical size. The
 * original solid palette remains available elsewhere; the homepage can opt
 * into the restrained green line-art treatment with `variant="line"`.
 *
 * Icons are decorative artwork (the tool title is always adjacent text), so
 * the root svg is aria-hidden; consumers can override with a label prop.
 */

export type ToolIconName =
  | 'microphone'
  | 'webcam'
  | 'headphones'
  | 'recorder'
  | 'tone'
  | 'keyboard'
  | 'mouse'
  | 'gamepad'
  | 'touch'
  | 'click'
  | 'reaction'
  | 'monitor'
  | 'refresh'
  | 'speed'
  | 'network'
  | 'gauge'
  | 'shield';

/** DeviceTry Phase 10 icon palette (light and dark equivalents). */
const P = {
  teal: '#0F766E',
  tealDark: '#115E59',
  tealSoft: '#99F6E4',
  coral: '#F97316',
  coralSoft: '#FED7AA',
  blue: '#2563EB',
  blueSoft: '#BFDBFE',
  green: '#16A34A',
  greenSoft: '#BBF7D0',
  amber: '#D97706',
  amberSoft: '#FDE68A',
  violet: '#7C3AED',
  violetSoft: '#DDD6FE',
  slate: '#475569',
  slateSoft: '#E2E8F0',
} as const;

export interface ToolIconProps {
  name: ToolIconName;
  /** Rendered square size in px. Cards use 44 (desktop) / 40 (mobile) via CSS. */
  size?: number;
  className?: string;
  /** Provide when the icon is the sole content of a control. */
  title?: string;
  /** Homepage cards use the green outline family without changing test pages. */
  variant?: 'solid' | 'line';
}

function LineToolIcon({ name, size = 44, className = '', title }: ToolIconProps) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    className: `text-[#15803D] dark:text-[#4ADE80] ${className}`,
    ...(title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }),
  };
  const line = (content: React.ReactNode) => (
    <svg {...shared}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </g>
    </svg>
  );

  switch (name) {
    case 'microphone':
      return line(
        <>
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
          <path d="M8 6.5h8M8 9.5h8" opacity="0.55" />
        </>
      );
    case 'webcam':
      return line(
        <>
          <circle cx="12" cy="9" r="6.5" />
          <circle cx="12" cy="9" r="3" />
          <circle cx="12" cy="3.5" r="0.8" />
          <path d="M9.5 15.5h5l-.7 4h-3.6l-.7-4ZM12 19.5V22M8.5 22h7" />
        </>
      );
    case 'headphones':
      return line(
        <>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <rect x="3" y="13" width="4.5" height="7" rx="2" />
          <rect x="16.5" y="13" width="4.5" height="7" rx="2" />
          <path d="M6 17h.01M18 17h.01" />
        </>
      );
    case 'recorder':
      return line(
        <>
          <path d="M5 20v-2.2A6.8 6.8 0 0 1 11.8 11h.4A6.8 6.8 0 0 1 19 17.8V20" />
          <path d="M9 11a4 4 0 1 1 6 0M4 14v3M20 14v3M7 17h2M15 17h2M12 15v4" />
        </>
      );
    case 'tone':
      return line(
        <>
          <path d="M2.5 12h2l2-6 3.2 12L13 6l2.2 6H21" />
          <path d="M4 19.5h16" opacity="0.55" />
        </>
      );
    case 'keyboard':
      return line(
        <>
          <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
          <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M9.5 13.5h.01M13 13.5h.01M16.5 13.5h.01M8 16h8" />
        </>
      );
    case 'mouse':
      return line(
        <>
          <rect x="7.5" y="2.5" width="9" height="19" rx="4.5" />
          <path d="M12 2.5v6M7.5 8.5h9" />
          <rect x="10.8" y="4.5" width="2.4" height="2" rx="1.2" />
        </>
      );
    case 'gamepad':
      return line(
        <>
          <path d="M7.2 7.5h9.6a5.3 5.3 0 0 1 5.2 4.3l.8 4.4a3.1 3.1 0 0 1-5.6 2.2l-1.1-1.7H8l-1.1 1.7a3.1 3.1 0 0 1-5.6-2.2l.8-4.4a5.3 5.3 0 0 1 5.1-4.3Z" />
          <path d="M7 10.5v4M5 12.5h4M16 11h.01M18 13h.01" />
        </>
      );
    case 'touch':
      return line(
        <>
          <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10" />
          <path d="M12 9V4.5a1.5 1.5 0 0 1 3 0V10" />
          <path d="M15 9V6.5a1.5 1.5 0 0 1 3 0v6.8c0 4.1-2.5 6.7-6.2 6.7h-.6c-2 0-3.4-.8-4.5-2.3l-2.6-3.5a1.6 1.6 0 0 1 2.4-2.1L9 14" />
        </>
      );
    case 'click':
      return line(
        <>
          <path d="m5 3 13 9-6.2 1.2L9 19 5 3Z" />
          <path d="m12.5 14 4.5 4.5M17 15v4h-4" />
        </>
      );
    case 'reaction':
      return line(
        <>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13 16 9M12 5V3M21 13h-2M5 13H3M9 3.9 7.6 2.5M17 3.9l1.4-1.4" />
          <path d="M9.5 13h5" />
        </>
      );
    case 'monitor':
      return line(
        <>
          <rect x="2.5" y="4" width="19" height="13" rx="2" />
          <path d="M8 21h8M12 17v4M6 8h4v3H6zM13 12h5M13 15h3" />
        </>
      );
    case 'refresh':
      return line(
        <>
          <path d="M19.5 8A8 8 0 0 0 5.2 6.5L3 9" />
          <path d="M3 4.5V9h4.5M4.5 16A8 8 0 0 0 18.8 17.5L21 15" />
          <path d="M21 19.5V15h-4.5" />
        </>
      );
    case 'speed':
      return line(
        <>
          <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
          <path d="M2.5 7.5h19M5 5.5h.01M8 5.5h.01" />
          <path d="M6.5 16a5.5 5.5 0 0 1 11 0M12 16l3-4M9 18.5h6" />
        </>
      );
    case 'network':
      return line(
        <>
          <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
          <path d="M2.5 7.5h19M5 5.5h.01M8 5.5h.01" />
          <circle cx="12" cy="14" r="3.5" />
          <path d="M8.5 14h7M12 10.5c1.3 1.8 1.3 5.2 0 7M12 10.5c-1.3 1.8-1.3 5.2 0 7" />
        </>
      );
    case 'gauge':
      return line(
        <>
          <path d="M4 17a8 8 0 1 1 16 0M12 17l3.5-7.5" />
          <circle cx="12" cy="17" r="1.5" />
          <path d="M12 5V3M5.6 7.5 4.2 6.1M18.4 7.5l1.4-1.4" />
        </>
      );
    case 'shield':
    default:
      return line(
        <>
          <path d="M12 2.8 19.5 5.6v6c0 4.6-3.2 7.9-7.5 9.6-4.3-1.7-7.5-5-7.5-9.6v-6L12 2.8Z" />
          <path d="m8.8 11.6 2.3 2.3 4.2-4.6" />
        </>
      );
  }
}

export function ToolIcon({ name, size = 44, className = '', title, variant = 'solid' }: ToolIconProps) {
  if (variant === 'line') {
    return <LineToolIcon name={name} size={size} className={className} title={title} />;
  }
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    ...(title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }),
  };

  switch (name) {
    case 'microphone':
      return (
        <svg {...shared}>
          <rect x="9" y="3" width="6" height="10" rx="3" fill={P.teal} />
          <path d="M6 11a6 6 0 0 0 12 0" stroke={P.teal} strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="21" stroke={P.teal} strokeWidth="2" strokeLinecap="round" />
          <path d="M4 10v1a8 8 0 0 0 5 7.4" stroke={P.blue} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <path d="M20 10v1a8 8 0 0 1-3 6.2" stroke={P.blue} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
        </svg>
      );

    case 'webcam':
      return (
        <svg {...shared}>
          <circle cx="12" cy="10" r="7" fill={P.teal} />
          <circle cx="12" cy="10" r="3.2" fill="#FFFFFF" />
          <circle cx="12" cy="10" r="1.6" fill={P.blue} />
          <circle cx="14" cy="8" r="0.9" fill="#FFFFFF" />
          <path d="M9.5 17h5L15 21H9l.5-4Z" fill={P.slate} />
        </svg>
      );

    case 'headphones':
      return (
        <svg {...shared}>
          <path d="M4 14v-3a8 8 0 0 1 16 0v3" stroke={P.teal} strokeWidth="2" strokeLinecap="round" />
          <rect x="3" y="13" width="4.5" height="7" rx="2" fill={P.coral} />
          <rect x="16.5" y="13" width="4.5" height="7" rx="2" fill={P.blue} />
          <path d="M12 6.2c1.4 0 2.6.5 3.6 1.3" stroke={P.tealSoft} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
        </svg>
      );

    case 'recorder':
      return (
        <svg {...shared}>
          <rect x="5" y="4" width="14" height="16" rx="2.5" fill={P.slateSoft} />
          <circle cx="12" cy="11" r="3" fill={P.coral} />
          <path d="M8 18h8" stroke={P.slate} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9.5 6.5h5" stroke={P.teal} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'tone':
      return (
        <svg {...shared}>
          <path d="M3 12h2.5l2-6 3 13 3-10 2 3H21" stroke={P.violet} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="21" cy="12" r="1.8" fill={P.amber} />
        </svg>
      );

    case 'keyboard':
      return (
        <svg {...shared}>
          <rect x="2.5" y="6" width="19" height="12" rx="2.5" fill={P.slateSoft} />
          <rect x="5" y="9" width="2.2" height="2.2" rx="0.5" fill={P.teal} />
          <rect x="8.4" y="9" width="2.2" height="2.2" rx="0.5" fill={P.teal} />
          <rect x="11.8" y="9" width="2.2" height="2.2" rx="0.5" fill={P.teal} />
          <rect x="15.2" y="9" width="2.2" height="2.2" rx="0.5" fill={P.teal} />
          <rect x="8.5" y="13" width="7" height="2.2" rx="0.5" fill={P.coral} />
        </svg>
      );

    case 'mouse':
      return (
        <svg {...shared}>
          <rect x="7.5" y="2.5" width="9" height="19" rx="4.5" fill={P.slateSoft} />
          <path d="M12 2.5v6" stroke={P.slate} strokeWidth="1.6" />
          <path d="M12 2.5 A 4.5 4.5 0 0 0 7.5 7 V 8.5 H 12 Z" fill={P.coral} />
          <path d="M12 12.5c1.6 0 2.7 1 2.7 2.4 0 1.4-.8 2.3-2.7 3.6-1.9-1.3-2.7-2.2-2.7-3.6 0-1.4 1.1-2.4 2.7-2.4Z" fill={P.blue} opacity="0.9" />
        </svg>
      );

    case 'gamepad':
      return (
        <svg {...shared}>
          <rect x="2" y="8" width="20" height="9" rx="4.5" fill={P.violet} />
          <path d="M8 10.6v3.4M6.3 12.3h3.4" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="15.8" cy="11.2" r="1" fill={P.amberSoft} />
          <circle cx="17.8" cy="13.4" r="1" fill={P.coralSoft} />
          <circle cx="12" cy="12.6" r="0" fill="#FFFFFF" />
        </svg>
      );

    case 'touch':
      return (
        <svg {...shared}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" fill={P.slateSoft} />
          <rect x="6.5" y="5.5" width="4.4" height="4.4" rx="1" fill={P.green} />
          <rect x="13.1" y="5.5" width="4.4" height="4.4" rx="1" fill={P.greenSoft} />
          <rect x="6.5" y="11.1" width="4.4" height="4.4" rx="1" fill={P.greenSoft} />
          <circle cx="12" cy="16" r="2.4" fill={P.teal} />
          <path d="M12 13.8V10" stroke={P.teal} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'click':
      return (
        <svg {...shared}>
          <path d="M9 4.5 11 9l-4.7.9L9 4.5Z" fill={P.amber} />
          <path d="M13 9.5c2 0 3.5 1.5 3.5 3.4 0 2-1.3 3.3-3.5 4.6-2.2-1.3-3.5-2.6-3.5-4.6 0-1.9 1.5-3.4 3.5-3.4Z" fill={P.teal} />
          <path d="M13 20v-2.4" stroke={P.teal} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 13H3M21 13h-2" stroke={P.coral} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'reaction':
      return (
        <svg {...shared}>
          <circle cx="12" cy="13" r="8" fill={P.slateSoft} />
          <path d="M12 13l4-4" stroke={P.coral} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="13" r="1.6" fill={P.slate} />
          <path d="M12 3.4v1.4M21.6 13h-1.4M4.4 13H3" stroke={P.teal} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'monitor':
      return (
        <svg {...shared}>
          <rect x="2.5" y="4" width="19" height="13" rx="2" fill={P.blue} />
          <rect x="4.5" y="6" width="15" height="9" rx="1" fill={P.blueSoft} />
          <rect x="7" y="8.2" width="2" height="2" rx="0.4" fill={P.coral} />
          <rect x="10" y="8.2" width="2" height="2" rx="0.4" fill={P.blue} />
          <rect x="13" y="8.2" width="2" height="2" rx="0.4" fill={P.green} />
          <rect x="10" y="11" width="5" height="2" rx="0.4" fill={P.amber} />
          <path d="M9 20h6M12 17v3" stroke={P.slate} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'refresh':
      // Refresh rate: screen outline with a motion arc — distinct from the
      // plain monitor (screen test) and dial (system info) ideas.
      return (
        <svg {...shared}>
          <rect x="3" y="4" width="18" height="12" rx="2" fill={P.teal} />
          <rect x="5" y="6" width="14" height="8" rx="1" fill={P.tealSoft} />
          <path d="M12 7.4a3.4 3.4 0 1 1-3.2 4.5" stroke={P.blue} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8.2 9.6 8.8 12l2.3-.9" stroke={P.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 20h6M12 17v3" stroke={P.slate} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'gauge':
      return (
        <svg {...shared}>
          <path d="M4 17a8 8 0 1 1 16 0" stroke={P.blue} strokeWidth="2" strokeLinecap="round" />
          <path d="M12 17 15.5 9.5" stroke={P.coral} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1.7" fill={P.slate} />
          <path d="M12 5.4V3.2" stroke={P.teal} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'speed':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8.5" fill={P.teal} />
          <path d="M12 12 16 8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.7" fill={P.amberSoft} />
          <path d="M12 6.2v1.4" stroke={P.tealSoft} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'network':
      return (
        <svg {...shared}>
          <rect x="2.5" y="3" width="19" height="12" rx="2" fill={P.blueSoft} />
          <rect x="4.5" y="5" width="15" height="8" rx="1" fill={P.blue} />
          <text x="12" y="11.4" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#FFFFFF" fontFamily="inherit">
            IP
          </text>
          <path d="M8 20h8M10 17.5h4M12 15v2.5" stroke={P.teal} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );

    case 'shield':
      return (
        <svg {...shared}>
          <path d="M12 2.8 19.5 5.6v6c0 4.6-3.2 7.9-7.5 9.6-4.3-1.7-7.5-5-7.5-9.6v-6L12 2.8Z" fill={P.green} opacity="0.9" />
          <path d="m8.8 11.6 2.3 2.3 4.2-4.6" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    default:
      return (
        <svg {...shared}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill={P.teal} />
        </svg>
      );
  }
}

/** Map a registry iconType to this icon family. */
export function toolIconTypeToName(iconType: string): ToolIconName {
  switch (iconType) {
    case 'microphone':
      return 'microphone';
    case 'webcam':
      return 'webcam';
    case 'headphones':
      return 'headphones';
    case 'keyboard':
      return 'keyboard';
    case 'mouse':
      return 'mouse';
    case 'gamepad':
      return 'gamepad';
    case 'touch':
      return 'touch';
    case 'monitor':
      return 'monitor';
    case 'gauge':
      return 'gauge';
    case 'shield':
      return 'shield';
    default:
      return 'shield';
  }
}

/**
 * Slug-based icon mapping — the primary way to resolve a tool's artwork.
 *
 * The registry's `iconType` strings are shared across tools (the voice
 * recorder registers as a microphone, click-speed as a mouse, refresh rate
 * as a gauge), which would repeat symbols for unrelated tools. Mapping by
 * slug gives all 15 primary tools a distinct icon; supporting diagnostics
 * get sensible fallbacks.
 */
export function toolSlugToIconName(slug: string): ToolIconName {
  switch (slug) {
    // ---- primary catalog (each unique)
    case 'microphone-test':
      return 'microphone';
    case 'webcam-test':
      return 'webcam';
    case 'speakers-test':
      return 'headphones';
    case 'voice-recorder':
      return 'recorder';
    case 'tone-generator':
      return 'tone';
    case 'keyboard-test':
      return 'keyboard';
    case 'mouse-test':
      return 'mouse';
    case 'gamepad-test':
      return 'gamepad';
    case 'touchscreen-test':
      return 'touch';
    case 'click-speed-test':
      return 'click';
    case 'reaction-time-test':
      return 'reaction';
    case 'screen-test':
      return 'monitor';
    case 'refresh-rate-test':
      return 'refresh';
    case 'internet-speed-test':
      return 'speed';
    case 'what-is-my-ip':
      return 'network';
    // ---- supporting diagnostics
    case 'permission-diagnostics':
      return 'shield';
    case 'browser-compatibility':
    case 'browser-system-info':
      return 'gauge';
    case 'codec-support':
      return 'tone';
    case 'webrtc-test':
      return 'network';
    case 'devicetry-storage-inspector':
      return 'monitor';
    default:
      return 'shield';
  }
}
