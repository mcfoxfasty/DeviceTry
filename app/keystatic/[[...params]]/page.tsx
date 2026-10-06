import type { Metadata } from 'next';

import KeystaticAdmin from '@/components/keystatic/KeystaticAdmin';

/**
 * The CMS itself, served at /keystatic.
 *
 * WHY THIS PAGE IS A SERVER COMPONENT THAT RENDERS A CLIENT COMPONENT.
 * The dashboard itself is client-only: `@keystatic/core/ui` ships a server build
 * whose component body is `return null`, because the admin signs in with GitHub
 * and draws its editor entirely in the browser. Rendering it from
 * components/keystatic/KeystaticAdmin.tsx — which carries 'use client' — is what
 * puts that code in the client graph. Until this split existed, the whole route
 * was server-rendered, the stub returned nothing, and /keystatic painted a blank
 * screen with no error anywhere.
 *
 * The split exists because `metadata` (below) can only be exported from a server
 * component, while `'use client'` and an `export const metadata` are mutually
 * exclusive in one file. Keeping this file server keeps the dashboard noindexed
 * without hiding it behind a client boundary that cannot declare metadata.
 *
 * NOT FOR SEARCH ENGINES. An admin dashboard has nothing to offer a crawler, and
 * its login screen would compete with real pages in results. `robots` is set here
 * as well as in app/robots.ts so the rule travels with the route rather than
 * depending on a crawler honouring one file.
 */
export const metadata: Metadata = {
  title: 'DeviceTry CMS',
  robots: { index: false, follow: false, nocache: true },
};

export default function KeystaticPage(): React.JSX.Element {
  return <KeystaticAdmin />;
}
