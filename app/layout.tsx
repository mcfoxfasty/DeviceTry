import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css'; // Global styles
import { SITE_URL } from '@/lib/site';
import { DEFAULT_OG_IMAGE } from '@/lib/seo/metadata';
import { ThemeInitScript } from '@/lib/theme';
import { BackToTop } from '@/components/layout/BackToTop';

/**
 * Brand wordmark face. Plus Jakarta Sans is a clean geometric sans with open
 * counters and a modern, even colour — the same feel as contemporary software
 * lockups — used only for the DeviceTry wordmark, not for page copy.
 *
 * Bundled locally (app/fonts) instead of fetched from Google at build time,
 * so builds are deterministic and never depend on fonts.googleapis.com. The
 * file is the official variable font covering wght 200–800, which includes
 * the 500/600/700 weights this brand lockup uses; declaring that exact range
 * keeps the browser interpolating weights exactly as the Google-served
 * variable file did, so rendered glyphs are identical.
 */
const brandFont = localFont({
  src: './fonts/plus-jakarta-sans-latin-wght-var.woff2',
  display: 'swap',
  weight: '200 800',
  style: 'normal',
  variable: '--font-brand',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
  description: 'Free online tests for microphone, webcam, keyboard, mouse, speakers, screen, gamepad, internet speed, and IP lookup — all in your browser.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
    description: 'Free online tests for microphone, webcam, keyboard, mouse, speakers, screen, gamepad, internet speed, and IP lookup — all in your browser.',
    type: 'website',
    url: SITE_URL,
    siteName: 'DeviceTry',
    // Every route inherits this 1200x630 card unless it declares an image of
    // its own (the guides do). Before it, no route but two guides emitted an
    // og:image at all, so a shared link previewed as a bare title.
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
    description: 'Free online tests for microphone, webcam, keyboard, mouse, speakers, screen, gamepad, internet speed, and IP lookup — all in your browser.',
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    /* The stored theme lives in localStorage, so only the browser knows it:
       ThemeInitScript sets `.dark` on <html> before first paint and React then
       hydrates markup the server could not have produced. React documents
       suppressHydrationWarning for exactly this one intentional attribute
       difference, and it is scoped to this element alone — a real mismatch
       anywhere else in the tree still reports. Dropping it would mean either
       rendering the class the server cannot know, or applying the theme after
       hydration and flashing light at dark-mode visitors. */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the stored Light/Dark choice before first paint.
            Dark is the default; only a stored Light opts out, and device dark
            preference is never consulted. */}
        <ThemeInitScript />
      </head>
      {/* The brand face is scoped to the body so it reaches the wordmark
          without touching the root element. */}
      <body className={brandFont.variable}>
        {/* First focusable element on every page: keyboard and screen-reader
            users can jump past the navigation straight to the page content,
            instead of tabbing through every nav control on each page. Each
            route's <main> carries id="main-content"; the link is off-screen
            until focused, then pinned under the top-left corner in the brand
            green with a visible focus ring. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:items-center focus:rounded-lg focus:bg-[#0F766E] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#0F766E] dark:focus:outline-[#14B8A6]"
        >
          Skip to main content
        </a>
        {children}
        <BackToTop />
      </body>
    </html>
  );
}
