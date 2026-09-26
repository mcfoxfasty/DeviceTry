import type {Metadata} from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css'; // Global styles
import { SITE_URL } from '@/lib/site';
import { ThemeInitScript } from '@/lib/theme';
import { BackToTop } from '@/components/layout/BackToTop';

/**
 * Brand wordmark face. Plus Jakarta Sans is a clean geometric sans with open
 * counters and a modern, even colour — the same feel as contemporary software
 * lockups — used only for the DeviceTry wordmark, not for page copy.
 */
const brandFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--font-brand',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
  description: 'Free online device tester for microphone, webcam, keyboard, mouse, speakers, display, gamepad, internet speed, and IP lookup. Tools run in your browser; nothing is uploaded unless a test says otherwise.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
    description: 'Free online device tester for microphone, webcam, keyboard, mouse, speakers, display, gamepad, internet speed, and IP lookup. Tools run in your browser; nothing is uploaded unless a test says otherwise.',
    type: 'website',
    url: SITE_URL,
    siteName: 'DeviceTry',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DeviceTry — Free Online Mic, Webcam, Keyboard & Screen Tests',
    description: 'Free online device tester for microphone, webcam, keyboard, mouse, speakers, display, gamepad, internet speed, and IP lookup.',
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
            Light is the default; device dark preference never forces dark. */}
        <ThemeInitScript />
      </head>
      {/* The brand face is scoped to the body so it reaches the wordmark
          without touching the root element. */}
      <body className={brandFont.variable}>
        {children}
        <BackToTop />
      </body>
    </html>
  );
}
