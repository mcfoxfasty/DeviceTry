import { GuideArticle } from '../schema';

export const mouseDoubleClicking: GuideArticle = {
  slug: 'mouse-double-clicking',
  title: 'Unwanted Mouse Double-Clicking: Causes and Real Fixes',
  description:
    'Why one click fires twice or a drag releases itself: switch chatter versus software settings, how to tell them apart, and what can be repaired.',
  category: 'input-gaming',
  type: 'troubleshooting',
  relatedToolSlugs: ['mouse-test', 'click-speed-test'],
  relatedGuideSlugs: ['keyboard-keys-not-registering'],
  intro:
    'When your mouse double-clicks on its own, selecting files opens two, or drags drop mid-gesture, you are seeing either switch chatter — the classic mechanical wear failure — or a software timing misconfiguration. A one-minute button test separates them, and the fix differs completely between the two.',
  published: true,
  publishedAt: new Date('2026-08-20'),
  updatedAt: new Date('2026-09-29'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'First: software or hardware?',
      paragraphs: [
        'Open the Mouse Test and click slowly and deliberately inside the button panel while watching the press counter. Count your clicks out loud. If the counter increments exactly once per physical click across a minute of clicking, that points at a software cause instead — a double-click speed setting, an app macro, or a driver feature like E-Clicks. If the counter jumps by two on some clicks, that is consistent with chatter: the switch contacts are bouncing. Neither result is a proof, because intermittent faults can stay hidden during a short test — click harder, in different spots, and for longer if you are not sure.',
      ],
    },
    {
      h2: 'Software causes and fixes',
      bullets: [
        'Windows: Settings → Bluetooth & devices → Mouse → Mouse pointer speed, and Control Panel → Mouse → Buttons → double-click speed. A very fast double-click threshold makes accidental near-simultaneous presses register as doubles.',
        'macOS: System Settings → Mouse → Double-click speed — lengthen it.',
        'Vendor utilities (Logi Options+, Razer Synapse, Corsair iCUE): disable "double click" or debounce experiment features and any macro bound to the button.',
        'Game-specific settings: some shooters add their own debounce; test outside the game before blaming the mouse.',
        'Wireless interference can generate phantom presses on 2.4 GHz mice; re-pair the dongle or move it to a front port.',
      ],
    },
    {
      h2: 'Switch chatter: what is actually happening',
      paragraphs: [
        'The micro-switch under the button is a tiny metal contact designed to snap between two states. After hundreds of thousands of actuations the contact oxidizes, fatigues, and starts bouncing — one physical press sends several electrical pulses. Browsers and games report each pulse as a click. Chatter usually gets worse over time rather than resolving itself, though how fast it happens varies a lot between mice. No operating system setting changes the physics; a setting can only stop your software from acting on the extra pulses.',
      ],
    },
    {
      h2: 'Real fixes for chatter',
      steps: [
        'Warranty first: chatter within the warranty window (commonly 2 years on mainstream brands) is generally treated as a defect, and replacement is usually the outcome the manufacturer will support.',
        'Opening and cleaning: on out-of-warranty mice, the switch can sometimes be revived by opening the shell and pressing a drop of contact cleaner into the switch, then exercising the button. This is a temporary reprieve, not a repair.',
        'Switch replacement: soldered mice need a soldering iron and a compatible switch (Omron D2F-series and clones vary in actuation force); hot-swap mice (a few enthusiast models) make it a two-minute job.',
        'Software debouncing tools exist but add input latency and rarely stop severe chatter — treat them as diagnostics, not fixes.',
      ],
    },
    {
      h2: 'The middle-button and scroll-wheel variants',
      paragraphs: [
        'A middle click that fires twice, or a scroll wheel that jumps directions, uses the same switch mechanism (and an encoder, for the wheel). The same test-and-warranty logic applies. Encoder jitter — scroll bouncing the wrong way — is likewise mechanical wear on the encoder wheel.',
      ],
    },
    {
      h2: 'Prevention and buying for the future',
      bullets: [
        'Switches are rated in millions of clicks; higher ratings tend to correlate with longer chatter-free life, though they are a laboratory figure and never a guarantee for a given mouse.',
        'Optical switches replace metal contacts with a light beam, which removes the contact-bounce failure mode entirely. They are not failure-proof — debris in the emitter or a damaged sensor can still break one — but if chatter has burned you repeatedly, that spec removes the specific cause you keep hitting.',
        'Keep the replacement decision honest: a $5 fix is not available for most mice — budget models are simply replaced.',
      ],
    },
  ],
  faqs: [
    {
      q: 'My mouse double-clicks only in one game. Is it broken?',
      a: 'Probably not. Games add their own click debounce and some emulate double clicks. Test in the browser Mouse Test: if it counts cleanly there, check the game\u2019s input settings first — though a fault that only appears under heavy clicking may still not show up in a short test.',
    },
    {
      q: 'Does double-click speed affect chatter?',
      a: 'No. The OS double-click threshold decides how fast two real presses merge into a "double-click" gesture. Chatter produces two presses from one physical action — different direction entirely.',
    },
    {
      q: 'Can I make a chattering mouse usable with software?',
      a: 'Debounce utilities can mask mild chatter by ignoring pulses within a window, at the cost of latency for genuine fast clicks. For competitive play or heavy clicking, hardware replacement is usually the more honest answer, since latency stays with you long after the debouncer does.',
    },
  ],
};
