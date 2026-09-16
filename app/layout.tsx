import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'DeviceTry - Hardware & Peripheral Diagnostic Suite',
  description: 'Professional browser-based device testing for microphone, webcam, keyboard, mouse, audio, display, and gamepad in English, French, and Arabic.',
  openGraph: {
    title: 'DeviceTry - Hardware & Peripheral Diagnostic Suite',
    description: 'Professional browser-based device testing for microphone, webcam, keyboard, mouse, audio, display, and gamepad in English, French, and Arabic.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DeviceTry - Hardware & Peripheral Diagnostic Suite',
    description: 'Professional browser-based device testing for microphone, webcam, keyboard, mouse, audio, display, and gamepad in English, French, and Arabic.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
