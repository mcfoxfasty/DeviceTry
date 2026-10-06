import { adminPassword, constantTimeEqual, signInCookie } from '@/lib/admin/session';

/**
 * The whole of signing in: one form post, one password check, one cookie.
 *
 * A relative `Location` is used deliberately. Building an absolute redirect from
 * `request.url` is wrong on this host stack — Next derives that URL from the
 * address it bound to (`next start -H 0.0.0.0` gives `http://0.0.0.0:3000`), which
 * is not a URL a browser can be sent to, and it was the source of the OAuth
 * redirect bug this dashboard replaced. `/admin` needs no origin at all.
 *
 * The password is compared in constant time, and a wrong attempt answers the same
 * redirect a right one does — back to the form with an error flag, never with a
 * hint about how close the guess was.
 *
 * `force-dynamic` keeps the route out of any prerender pass: it reads a secret and
 * mutates a cookie, so it must run per request and only on the server.
 */

export const dynamic = 'force-dynamic';

/** A redirect that carries no body and is never cached. */
function redirectTo(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location, 'cache-control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  let submitted = '';
  try {
    const form = await request.formData();
    const value = form.get('password');
    submitted = typeof value === 'string' ? value : '';
  } catch {
    // A body that is not a form (or none at all) is simply a failed attempt.
  }

  const password = adminPassword();
  if (!constantTimeEqual(submitted, password)) {
    return redirectTo('/admin/login?error=1');
  }

  const response = redirectTo('/admin');
  response.headers.append('set-cookie', await signInCookie(password));
  return response;
}
