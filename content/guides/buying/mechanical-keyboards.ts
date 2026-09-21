import { GuideArticle } from '../schema';

export const mechanicalKeyboards: GuideArticle = {
  slug: 'mechanical-keyboards',
  title: 'Buying Guide: Mechanical Keyboards',
  description:
    'Switch types, sizes, connectivity, and hot-swap sockets explained without jargon — with specification-based picks for offices, travel, and long-term tinkering.',
  category: 'input-gaming',
  type: 'buying',
  relatedToolSlugs: ['keyboard-test', 'click-speed-test'],
  relatedGuideSlugs: ['keyboard-keys-not-registering'],
  intro:
    'Mechanical keyboards last longer than membrane boards and feel dramatically different switch to switch — but the vocabulary (tactile, linear, hot-swap, 75%) hides simple ideas. This guide translates the specifications that change daily use, then maps them to three distinct picks. Selections are specification-based; we do not perform lab testing, and every linked manufacturer page is the source of record.',
  published: true,
  publishedAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'The four decisions that matter',
      bullets: [
        'Switch type: linear (smooth, quiet-ish, gamer favorite), tactile (a bump you can feel, the typist favorite), clicky (audible click — genuinely annoying in shared spaces).',
        'Size: full-size has a numpad; tenkeyless drops it; 75% and 65% are compact but keep arrows; 60% drops arrows and function rows.',
        'Hot-swap sockets: you can change switches without soldering — the single most future-proof feature a board can have.',
        'Connectivity: wired-only is simplest; Bluetooth suits multi-device desks; 2.4 GHz dongles add gaming-grade wireless.',
      ],
    },
    {
      h2: 'Specification-based picks',
      productIds: ['kb-keychron-k2-v2', 'kb-logitech-mx-mechanical', 'kb-nuphy-air75'],
      productNotes: {
        'kb-keychron-k2-v2':
          'The tinkerer\u2019s default: hot-swappable sockets, wired and Bluetooth operation, and a 75% layout that keeps arrows and function keys. If you want one board to grow with, this is the specification to beat.',
        'kb-logitech-mx-mechanical':
          'The office pick: quiet low-profile Kailh switches, multi-host switching, and sensor-driven backlighting — built for meeting-heavy days rather than customization.',
        'kb-nuphy-air75':
          'The travel pick: an unusually light 75% board with tri-mode wireless and hot-swap low-profile switches, for people who type in cafes as often as at desks.',
      },
    },
    {
      h2: 'Compatibility facts worth checking',
      bullets: [
        'All three work on Windows and macOS; each has a mode switch or software step for correct media keys.',
        'Linux users: Keychron and NuPhy boards behave as standard HID devices; Logitech\u2019s Bolt receiver needs recent kernel support.',
        'Hot-swap sockets accept 3-pin and most 5-pin MX-style switches — buy a switch tester or variety pack before committing to a full set.',
      ],
    },
    {
      h2: 'Trade-offs to accept',
      paragraphs: [
        'Mechanical boards are heavier, pricier, and louder than the membrane keyboard they replace — the MX Mechanical mitigates noise with low-profile quiet switches, while the Keychron and NuPhy embrace the feel at the cost of some sound. Compact sizes drop the numpad; if you enter numbers all day, that is a real loss, not a style choice. And Bluetooth boards disable some features to manage power — the K2, for example, turns off RGB backlighting in wireless mode.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Are hot-swappable keyboards worse than soldered ones?',
      a: 'For typing, no difference. Hot-swap adds switch-changing flexibility with a marginal durability question on the sockets themselves — for almost everyone the flexibility is worth it.',
    },
    {
      q: 'Which switch should a first-time buyer choose?',
      a: 'Tactile. It gives the mechanical feel with moderate noise, suits typing and gaming, and forgives the "I did not know I preferred linear" mistake less painfully than a full clicky set.',
    },
    {
      q: 'How do I test that every key on a new board works?',
      a: 'Run the Keyboard Test and press each key; a new board should register every single one. Do this within your return window.',
    },
  ],
};
