import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'DeviceTry - Browser-Based Hardware Diagnostic Tools',
  description: 'Professional browser-based device testing for microphone, webcam, keyboard, mouse, audio, display, and gamepad. 100% client-side, nothing uploaded.',
  openGraph: {
    title: 'DeviceTry - Browser-Based Hardware Diagnostic Tools',
    description: 'Professional browser-based device testing for microphone, webcam, keyboard, mouse, audio, display, and gamepad. 100% client-side, nothing uploaded.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DeviceTry - Browser-Based Hardware Diagnostic Tools',
    description: 'Professional browser-based device testing for microphone, webcam, keyboard, mouse, audio, display, and gamepad. 100% client-side, nothing uploaded.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
