import React from 'react';

/**
 * Phase 10 original SVG icon family.
 *
 * A compact, geometric icon set inspired by the clarity of iLovePDF's tool
 * cards — NOT a copy of their paths, symbols, or branding. One recognizable
 * visual idea per tool, solid color blocks, consistent 24-unit viewBox and
 * optical size. The palette is DeviceTry's: teal primary with coral, blue,
 * green, amber, and violet complements.
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
  | 'gauge'
  | 'speed'
  | 'network'
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
}

export function ToolIcon({ name, size = 44, className = '', title }: ToolIconProps) {
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
