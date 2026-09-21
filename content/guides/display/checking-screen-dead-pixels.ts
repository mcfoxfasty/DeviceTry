import { GuideArticle } from '../schema';

export const checkingScreenDeadPixels: GuideArticle = {
  slug: 'checking-screen-dead-pixels',
  title: 'How to Check a Screen for Dead and Stuck Pixels',
  description:
    'A practical walkthrough for finding dead, stuck, and hot pixels on any display: the right colors to use, fullscreen technique, lighting conditions, and how to tell defects from software artifacts.',
  category: 'display',
  type: 'how-to',
  relatedToolSlugs: ['screen-test', 'refresh-rate-test'],
  relatedGuideSlugs: ['home-office-monitors'],
  intro:
    'Every pixel on your screen is a tiny light with three sub-lamps, and a handful out of millions can fail without the display "breaking". Finding them deliberately — rather than staring at everyday content — takes the right colors, the right conditions, and about five minutes. Here is the method professionals use before accepting a new display or filing a warranty claim.',
  published: true,
  publishedAt: new Date('2026-08-22'),
  updatedAt: new Date('2026-09-15'),
  hasAffiliateLinks: false,
  sections: [
    {
      h2: 'Know what you are looking for',
      bullets: [
        'Dead pixel: a pixel that stays black on every color — its power or driver has failed entirely. Most visible on white or bright backgrounds.',
        'Stuck pixel: a pixel frozen on one color (red, green, or blue) regardless of content — one sub-pixel\u2019s transistor stuck on. Most visible on the opposite solid color.',
        'Hot pixel: a pixel that glows white or overly bright on dark content — the inverse failure.',
        'Backlight bleed and clouding: bright patches near edges, especially on dark content — a panel/assembly characteristic, not a pixel defect.',
      ],
    },
    {
      h2: 'The fullscreen color walkthrough',
      steps: [
        'Open the Screen Test and switch to the Dead Pixel tab.',
        'Enter fullscreen (F11 or the built-in button) so browser chrome and desktop icons cannot hide anything.',
        'Step through each solid color — white, black, red, green, blue, gray — spending 20–30 seconds scanning each screen in a slow grid pattern, not a casual glance.',
        'On white: hunt for black dots (dead pixels).',
        'On black: hunt for glowing dots (stuck-on or hot pixels) and note edge glow separately.',
        'On red, green, blue: hunt for the opposite-colored dots — these reveal single stuck sub-pixels.',
        'Move your viewing angle slightly during each color; some defects appear only off-axis.',
      ],
    },
    {
      h2: 'Set the conditions properly',
      bullets: [
        'Dim the room: a bright environment washes out faint defects and makes your pupils constrict.',
        'Set brightness to your normal working level or slightly higher — max brightness exaggerates glow and can hide dark defects relative to normal use.',
        'Clean the screen first: dust, smears, and dead insects behind glass look remarkably like pixel defects.',
        'Let the display reach normal operating temperature; some panel behavior differs when cold.',
      ],
    },
    {
      h2: 'Confirming a defect (and not a software artifact)',
      paragraphs: [
        'Genuine pixel defects persist across colors, applications, restarts, and even other devices if you connect the panel elsewhere. If a suspicious dot moves when you scroll, it is software (a stuck icon, a cursor trail). If it disappears in a screenshot viewed on another screen, the defect is not in the panel. Take a photo at a slight angle if a manufacturer asks for evidence — camera sensors pick up dead pixels clearly on solid colors.',
      ],
    },
    {
      h2: 'After you find one',
      paragraphs: [
        'Manufacturer policies differ sharply: many panel makers define a minimum count or cluster size before a warranty claim succeeds, while retail return windows are often more forgiving in the first days. Before claiming: check your display\u2019s specific pixel policy in the warranty documentation, count and photograph every defect with the color shown on screen, and note the purchase date. Pixel-fixing software that rapidly cycles colors can occasionally revive a stuck sub-pixel, but it never repairs a truly dead pixel — and on modern panels its success rate is close to chance.',
      ],
    },
    {
      h2: 'Reading results honestly',
      paragraphs: [
        'A clean pass on every color at fullscreen gives you high confidence the panel has no significant pixel defects. It cannot certify sub-pixel uniformity, backlight behavior in dark rooms, or panel aging — and one pass never guarantees zero manufacturing defects elsewhere. For brightness and uniformity complaints, combine this walkthrough with content you know well, and for the timing side of display quality, the Refresh Rate Test covers the browser-rendering side separately.',
      ],
    },
  ],
  faqs: [
    {
      q: 'How many dead pixels justify a warranty claim?',
      a: 'Policies vary by manufacturer: some accept a single bright pixel, others require several dark pixels or a minimum cluster. Check your specific panel\u2019s documented pixel policy before claiming.',
    },
    {
      q: 'Are dead pixels fixable at home?',
      a: 'Truly dead pixels are not. Stuck sub-pixels occasionally unstick after rapid color cycling or gentle pressure methods, but success is unreliable and pressure risks worse damage.',
    },
    {
      q: 'Why do I see edge glow on black but the test found no dead pixels?',
      a: 'That is backlight bleed or panel glow — an assembly characteristic of the display, not a pixel defect, and it varies with brightness, angle, and room lighting.',
    },
    {
      q: 'Do I need an app for this?',
      a: 'No. Solid fullscreen colors from the browser are sufficient, and nothing is installed or downloaded. The same method works on phones, tablets, laptops, and external monitors.',
    },
  ],
};
