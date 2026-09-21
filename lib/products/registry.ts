/**
 * Central product registry (Phase 9, item J).
 *
 * - Articles reference STABLE product IDs — never duplicated purchase URLs.
 * - Changing a product's link here updates every article using it after
 *   deployment.
 * - `affiliateUrls` stay EMPTY until the owner supplies genuine links; the
 *   purchase button is hidden while no URL is configured, and the clearly
 *   labeled manufacturer link remains.
 * - Never invent tracking tags or affiliate account IDs. Never scrape
 *   retailer prices, ratings, or images. Prices/availability are not shown
 *   without an approved compliant data method.
 * - `sourceUrl` is the verified factual reference (manufacturer preferred).
 */

export type ProductCategory =
  | 'microphone'
  | 'webcam'
  | 'keyboard'
  | 'headphones'
  | 'monitor'
  | 'controller';

export type Market = 'US' | 'UK' | 'DE' | 'EU';

export interface Product {
  /** Stable ID referenced by articles. Never repurpose an existing ID. */
  id: string;
  name: string;
  manufacturer: string;
  category: ProductCategory;
  /** Verified factual source URL (manufacturer page preferred). */
  sourceUrl: string;
  /** Key compatibility facts (connectors, platforms, requirements). */
  compatibility: string[];
  /** Specification-based editorial advantages — clearly not hands-on claims. */
  advantages: string[];
  /** Honest drawbacks/trade-offs, including spec omissions. */
  limitations: string[];
  /** Optional approved image reference (manufacturer press asset URL). */
  imageUrl?: string;
  /** Merchant product URLs by market (non-affiliate unless configured). */
  merchantUrls?: Partial<Record<Market, string>>;
  /** Affiliate URLs by market — EMPTY until the owner supplies real links. */
  affiliateUrls?: Partial<Record<Market, string>>;
  /** Date of the last factual review of sourceUrl content. */
  factualReviewDate: Date;
}

export const PRODUCTS: Record<string, Product> = {
  // ------------------------------------------------------------- microphones
  'mic-blue-yeti': {
    id: 'mic-blue-yeti',
    name: 'Yeti',
    manufacturer: 'Logitech for Creators (Blue)',
    category: 'microphone',
    sourceUrl: 'https://www.logitech.com/en-us/products/streaming-gear/yeti-usb-microphone.html',
    compatibility: ['USB-A/USB-C (model dependent)', 'Windows', 'macOS', 'No drivers needed on modern OS versions'],
    advantages: [
      'Multiple capsule patterns (stereo, cardioid, omni, bidirectional)',
      'On-mic headphone monitoring with dedicated volume control',
      'Mute button and gain knob on the body',
    ],
    limitations: [
      'Large desktop footprint and no built-in travel protection',
      'USB only on this model — no XLR input',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'mic-samson-q2u': {
    id: 'mic-samson-q2u',
    name: 'Q2U',
    manufacturer: 'Samson',
    category: 'microphone',
    sourceUrl: 'https://www.samsontech.com/samson/products/microphones/usb-microphones/q2u/',
    compatibility: ['USB and XLR outputs', 'Windows', 'macOS', 'Includes foam windscreen and desktop tripod'],
    advantages: [
      'Dynamic capsule tolerates untreated rooms better than condensers',
      'Dual USB/XLR output enables future mixer upgrades without replacing the mic',
      'Headphone jack with mix control for zero-latency monitoring',
    ],
    limitations: [
      'Needs to sit close to the speaker for best signal-to-noise',
      'Desk stand is lightweight; boom arm sold separately',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'mic-jlab-talk-go': {
    id: 'mic-jlab-talk-go',
    name: 'Talk GO',
    manufacturer: 'JLab',
    category: 'microphone',
    sourceUrl: 'https://www.jlab.com/products/talk-go-usb-microphone',
    compatibility: ['USB-C', 'Windows', 'macOS', 'PS4/PS5 (USB audio)'],
    advantages: [
      'Compact, travel-friendly cardiod USB mic',
      'Two-position mic gain/volume control',
      'Simple plug-and-play setup',
    ],
    limitations: [
      'No headphone monitoring jack',
      'Fixed cardioid pattern only',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },

  // ------------------------------------------------------------------ webcams
  'cam-logitech-brio-500': {
    id: 'cam-logitech-brio-500',
    name: 'Brio 500',
    manufacturer: 'Logitech',
    category: 'webcam',
    sourceUrl: 'https://www.logitech.com/en-us/products/webcams/brio-500-business-webcam.html',
    compatibility: ['USB-C', 'Windows', 'macOS', 'ChromeOS', 'Privacy shutter built in'],
    advantages: [
      '1080p60 capture with auto light correction aimed at dim rooms',
      'RightLight with Show Mode tilts the camera for desk-share',
      'Works with Logi Tune for framing and firmware updates',
    ],
    limitations: [
      'No 4K capture on this model',
      'Fixed focus — expect softness closer than about 30 cm',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'cam-elgato-facecam-mk2': {
    id: 'cam-elgato-facecam-mk2',
    name: 'Facecam MK.2',
    manufacturer: 'Elgato',
    category: 'webcam',
    sourceUrl: 'https://www.elgato.com/uk/en/p/facecam-mk2',
    compatibility: ['USB-C', 'Windows 10+', 'macOS (Camera Hub app)', 'UVC — no capture driver required'],
    advantages: [
      'Sony STARVIS sensor tuned for low-light exposure control',
      'Manual ISO/shutter/white-balance control via Camera Hub',
      'On-chip H.264 encoding reduces host CPU load',
    ],
    limitations: [
      'Premium price versus mainstream webcams',
      'Camera Hub app required to unlock manual controls',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'cam-logitech-c920s': {
    id: 'cam-logitech-c920s',
    name: 'C920s',
    manufacturer: 'Logitech',
    category: 'webcam',
    sourceUrl: 'https://www.logitech.com/en-us/products/webcams/c920s-hd-pro-webcam.html',
    compatibility: ['USB-A', 'Windows', 'macOS', 'ChromeOS', 'Xbox (UVC mode)', 'Privacy shutter included'],
    advantages: [
      'Long-standing UVC compatibility record across OSes',
      '1080p30 with dependable auto-exposure',
      'Physical privacy shutter',
    ],
    limitations: [
      'No 60 fps mode',
      'Plastic clip mount suits thin monitors best',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },

  // ----------------------------------------------------------------- keyboards
  'kb-keychron-k2-v2': {
    id: 'kb-keychron-k2-v2',
    name: 'K2 Version 2',
    manufacturer: 'Keychron',
    category: 'keyboard',
    sourceUrl: 'https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard',
    compatibility: ['Bluetooth 5.1 (3 devices)', 'USB-C wired', 'Windows/macOS switch', '75% layout'],
    advantages: [
      'Hot-swappable sockets make switch replacement solder-free',
      'Wired and wireless operation with battery indicator',
      'Aluminum-frame option with built-in tilt feet',
    ],
    limitations: [
      '75% layout drops the dedicated numpad',
      'Bluetooth mode disables RGB backlighting on this model to save power',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'kb-logitech-mx-mechanical': {
    id: 'kb-logitech-mx-mechanical',
    name: 'MX Mechanical',
    manufacturer: 'Logitech',
    category: 'keyboard',
    sourceUrl: 'https://www.logitech.com/en-us/products/combos/mx-mechanical-wireless-keyboard.html',
    compatibility: ['Bluetooth LE / Logi Bolt receiver', 'Windows', 'macOS', 'Linux (Logi Bolt)'],
    advantages: [
      'Quiet Kailh Choc V2 low-profile switches',
      'Multi-host switching across three devices',
      'Backlight with proximity and hand-detection sensors',
    ],
    limitations: [
      'Keys are not hot-swappable',
      'Full features require Logi Options+ software',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'kb-nuphy-air75': {
    id: 'kb-nuphy-air75',
    name: 'Air75 V2',
    manufacturer: 'NuPhy',
    category: 'keyboard',
    sourceUrl: 'https://nuphy.com/products/air75-v2',
    compatibility: ['Bluetooth 5.0 (3 hosts)', '2.4 GHz dongle', 'USB-C wired', 'Windows/macOS/Linux/Android'],
    advantages: [
      'Very light 75% travel board (about 0.5 kg)',
      'Hot-swappable low-profile switches',
      'Tri-mode connectivity including 2.4 GHz for lower-latency wireless',
    ],
    limitations: [
      'Low-profile keycap ecosystem is smaller than standard MX',
      'Mac/Linux media-row behavior needs remapping on some hosts',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },

  // ---------------------------------------------------------------- headphones
  'hp-audio-technica-ath-m50x': {
    id: 'hp-audio-technica-ath-m50x',
    name: 'ATH-M50x',
    manufacturer: 'Audio-Technica',
    category: 'headphones',
    sourceUrl: 'https://www.audio-technica.com/en-us/ath-m50x',
    compatibility: ['3.5 mm wired with detachable cable', '1.2–3 m coiled and straight cables included', 'No mic on stock cable'],
    advantages: [
      'Closed-back, well-isolating studio monitoring design',
      'Detachable cable system',
      'Collapsible swiveling earcups for storage',
    ],
    limitations: [
      'No inline microphone on the stock cable — pair with a USB mic for calls',
      'Clamping force is firm out of the box',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'hp-sony-wh-1000xm5': {
    id: 'hp-sony-wh-1000xm5',
    name: 'WH-1000XM5',
    manufacturer: 'Sony',
    category: 'headphones',
    sourceUrl: 'https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b',
    compatibility: ['Bluetooth 5.2 with multipoint (2 devices)', 'USB-C charging', '3.5 mm passive wired mode', 'Companion app for EQ'],
    advantages: [
      'Active noise cancellation tuned for commuting and offices',
      'Multipoint pairing across work and personal devices',
      'Wired fallback keeps them usable with zero battery',
    ],
    limitations: [
      'Earcups do not fold flat like earlier generations',
      'ANC performance depends on seal — glasses can reduce it',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'hp-audio-technica-ath-m20x': {
    id: 'hp-audio-technica-ath-m20x',
    name: 'ATH-M20x',
    manufacturer: 'Audio-Technica',
    category: 'headphones',
    sourceUrl: 'https://www.audio-technica.com/en-us/ath-m20x',
    compatibility: ['3.5 mm wired', 'Fixed cable', 'No mic'],
    advantages: [
      'Budget closed-back monitoring reference with neutral tuning focus',
      'Lightweight build for long desk sessions',
    ],
    limitations: [
      'Fixed non-detachable cable',
      'No microphone or remote',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },

  // ----------------------------------------------------------------- monitors
  'mn-dell-u2723qe': {
    id: 'mn-dell-u2723qe',
    name: 'UltraSharp U2723QE',
    manufacturer: 'Dell',
    category: 'monitor',
    sourceUrl: 'https://www.dell.com/en-us/shop/dell-ultrasharp-27-4k-usb-c-hub-monitor-u2723qe/apd/210-bdxt/monitors-monitor-accessories',
    compatibility: ['USB-C with 90 W power delivery', 'HDMI/DisplayPort', 'KVM switch built in', 'VESA 100 mm'],
    advantages: [
      '4K IPS Black panel with high contrast for office and photo work',
      'Single-cable USB-C docking with hub ports',
      'Ergonomic stand with USB-C cable management',
    ],
    limitations: [
      '60 Hz — not aimed at high-refresh gaming',
      'Premium price over general-purpose 27-inch 4K panels',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'mn-lg-27ul650': {
    id: 'mn-lg-27ul650',
    name: '27UL650-W',
    manufacturer: 'LG',
    category: 'monitor',
    sourceUrl: 'https://www.lg.com/us/monitors/lg-27ul650-w-4k-uhd-led-monitor',
    compatibility: ['HDMI 2.0', 'DisplayPort', 'AMD FreeSync', 'VESA 100 mm'],
    advantages: [
      'Budget 4K 60 Hz IPS with HDR10 support',
      'Height-adjustable stand at a lower price tier',
    ],
    limitations: [
      'HDR support is entry-level; brightness is limited for true HDR impact',
      'No USB-C video input',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'mn-dell-se2422hx': {
    id: 'mn-dell-se2422hx',
    name: 'SE2422HX',
    manufacturer: 'Dell',
    category: 'monitor',
    sourceUrl: 'https://www.dell.com/en-us/shop/dell-24-monitor-se2422hx/apd/210-bbrs/monitors-monitor-accessories',
    compatibility: ['HDMI', 'VGA', 'Tilt-only stand'],
    advantages: [
      'Inexpensive 1080p 75 Hz office panel with AMD FreeSync',
      'Compact footprint with 60 Hz+ operation for standard productivity',
    ],
    limitations: [
      'Tilt-only stand; VESA mount requires an adapter arm',
      '1080p at 24 inches — fine for office, not for fine-detail design',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },

  // --------------------------------------------------------------- controllers
  'ctl-xbox-series-controller': {
    id: 'ctl-xbox-series-controller',
    name: 'Xbox Wireless Controller',
    manufacturer: 'Microsoft',
    category: 'controller',
    sourceUrl: 'https://www.xbox.com/en-US/accessories/controllers/xbox-wireless-controller',
    compatibility: ['Xbox Series X|S / One', 'Windows 10/11 (USB-C, Bluetooth, Xbox Wireless)', 'Android/iOS (Bluetooth)', 'Trigger rumble on Windows/Xbox'],
    advantages: [
      'Broadest PC game compatibility via the Xbox Input standard',
      'Hybrid D-pad and textured grip for shooter input',
      'Share button and AA/USB-C battery flexibility',
    ],
    limitations: [
      'No gyro aiming on this controller',
      'Bluetooth audio accessories required for headset on non-Xbox hosts',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'ctl-8bitdo-ultimate-2c': {
    id: 'ctl-8bitdo-ultimate-2c',
    name: 'Ultimate 2C',
    manufacturer: '8BitDo',
    category: 'controller',
    sourceUrl: 'https://www.8bitdo.com/ultimate2c/',
    compatibility: ['Windows (2.4 GHz dongle)', 'Android/iOS depending on model variant', 'Hall-effect sticks (drift-resistant)'],
    advantages: [
      'Hall-effect electromagnetic sticks resist stick drift by design',
      '2.4 GHz dongle with low reported latency for PC use',
      'Budget price point',
    ],
    limitations: [
      'No Bluetooth on the Windows 2C variant',
      'Software customization is Windows-only',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
  'ctl-dualsense': {
    id: 'ctl-dualsense',
    name: 'DualSense Wireless Controller',
    manufacturer: 'Sony',
    category: 'controller',
    sourceUrl: 'https://www.playstation.com/en-us/accessories/dualsense-wireless-controller/',
    compatibility: ['PS5', 'Windows (Bluetooth/USB-C; Steam Input recommended)', 'Android/iOS (basic mapping)', 'Built-in mic + headset jack'],
    advantages: [
      'Adaptive triggers and haptics in supporting PS5 titles',
      'Built-in microphone and headset jack for calls',
      'Comfortable full-size grip',
    ],
    limitations: [
      'Advanced features need app/Steam support on PC; XInput mapping is partial without it',
      'Battery life is shorter than some rivals under heavy haptics use',
    ],
    factualReviewDate: new Date('2026-09-10'),
  },
};

/** Resolve product IDs referenced by articles, preserving order. */
export function resolveProducts(ids: string[]): Product[] {
  return ids.map((id) => PRODUCTS[id]).filter((p): p is Product => Boolean(p));
}

/** True only when the product has a REAL affiliate URL configured for a market. */
export function getAffiliateUrl(product: Product, market: Market = 'US'): string | undefined {
  return product.affiliateUrls?.[market];
}

/** Non-affiliate manufacturer source link (always available and labeled). */
export function getManufacturerUrl(product: Product): string {
  return product.sourceUrl;
}
