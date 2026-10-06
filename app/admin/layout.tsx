import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * The admin shell.
 *
 * Its own layout, with no site navigation and no footer, because this is a tool
 * for the site owner rather than a page for readers. The `robots` directive here
 * is what keeps a dashboard and its login form out of search results — the page
 * itself exports `metadata` (a server component can), so the noindex travels with
 * every route under /admin without repeating it in each file.
 *
 * The colours are the site's own tokens, so the dashboard follows the theme the
 * visitor chose elsewhere on the site (dark by default).
 */
export const metadata: Metadata = {
  title: 'Admin — DeviceTry',
  description: 'The DeviceTry publishing dashboard.',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6FB] dark:bg-[#0B111A] text-[#142033] dark:text-[#E9EEF4] font-sans">
      {children}
    </div>
  );
}
