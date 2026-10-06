import { signOutCookie } from '@/lib/admin/session';

/**
 * Signing out: clear the cookie and go back to the form.
 *
 * A POST rather than a link, so a prefetch or an accidental click on a shared
 * screenshot cannot end someone's session. The clearing cookie repeats the
 * original attributes (path, SameSite, Secure) because a browser only replaces a
 * cookie whose attributes match.
 */

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const response = new Response(null, {
    status: 303,
    headers: { location: '/admin/login', 'cache-control': 'no-store' },
  });
  response.headers.append('set-cookie', signOutCookie());
  return response;
}
