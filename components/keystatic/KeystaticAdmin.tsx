'use client';

import { makePage } from '@keystatic/next/ui/app';
import { useEffect } from 'react';
import keystaticConfig from '../../keystatic.config';
import { isGithubApiRequest, redactSecrets } from '../../lib/keystatic/oauthDiagnostics';

/**
 * The Keystatic admin, mounted as a client component, plus the one sign-in
 * fallback an embedded or phone browser needs.
 *
 * WHY THIS FILE EXISTS, AND WHY IT CARRIES 'use client'.
 * `makePage` builds the dashboard from `@keystatic/core/ui`, and that package
 * ships two builds. The server build of the component is deliberately a stub:
 *
 *     function Keystatic(props) {
 *       if (props.config.storage.kind === 'github') assertValidRepoConfig(...);
 *       return null;
 *     }
 *
 * The admin is a browser application — it signs in with GitHub, reads and writes
 * this repository through app/api/keystatic/[...params]/route.ts, and renders its
 * own editor — so the server answers "nothing to draw" and the CLIENT is meant to
 * paint the real interface. That only happens when this module is in the client
 * graph, and 'use client' is what puts it there.
 *
 * WITHOUT IT: nothing throws. The route stays entirely server-rendered, the stub
 * returns null, the route's client chunk builds to an empty 163-byte shell with
 * no Keystatic code in it, and the browser never requests a thing — /keystatic
 * then serves a perfectly healthy 200 whose body contains only a screen-reader
 * skip link on a dark background. No console error, no failed request, no CSP
 * violation: just a blank screen, which is exactly what made this hard to see.
 *
 * WHY THE DIRECTIVE IS NOT ON page.tsx: a 'use client' module cannot export
 * `metadata`, and the page exports `metadata` to keep an admin dashboard out of
 * search results (`robots: { index: false }`). Keeping the page a server
 * component and rendering this from it preserves the noindex while giving the
 * dashboard a client boundary.
 *
 * WHAT THIS FILE DOES ABOUT MOBILE SIGN-IN, AND WHAT IT DELIBERATELY DOES NOT.
 * Keystatic's GitHub flow is ALREADY a full-page redirect, so there is no popup
 * flow to replace and no `keystatic.config.ts` setting that could choose one:
 * the auth gate renders a plain anchor to /api/keystatic/github/login with
 * `target="_top"`, the server answers 307 to github.com/login/oauth/authorize,
 * and the return trip lands on /api/keystatic/github/oauth/callback, which sets
 * the session cookies and redirects to the dashboard. `window.open` appears zero
 * times in the whole @keystatic/core/ui bundle, and the install-completion
 * handshake is a `storage` event (`ks-refetch-installations`) that no
 * `window.opener` is needed for. Nothing here re-implements any of that.
 *
 * The one case that genuinely breaks on a phone or in an embedded browser is
 * `target="_top"` inside a cross-origin frame: a sandboxed iframe can refuse the
 * top-level navigation, and iOS in-app browsers will not keep a same-tab
 * navigation alive across the trip to GitHub. `useEmbeddedSignIn` handles only
 * that case — it is inert on an ordinary top-level page.
 *
 * WHICH GITHUB API FAILURES ARE INVISIBLE WITHOUT THE CAPTURE BELOW.
 * Keystatic's dashboard is the only place the token it was issued is actually
 * used: it queries api.github.com from the browser, and a refusal there (401 Bad
 * credentials, 403 Resource not accessible by integration, or GraphQL `errors`
 * inside a 200) puts the reader back on the login screen with nothing said. That
 * request never passes through this site's server, so `useGithubApiCapture`
 * records it in the console instead — redacted, and only when it fails.
 *
 * `keystatic.config.ts` is imported here as well as by the server (the reader in
 * lib/blog/content.ts). That duplication is normal: the schema is what the editor
 * draws its fields from, and it contains no server-only code.
 */

/** The endpoint the auth gate links to. Keystatic builds this same href itself. */
const SIGN_IN_HREF = '/api/keystatic/github/login';

const Admin = makePage(keystaticConfig);

/**
 * Continue a sign-in that this frame is not allowed to finish.
 *
 * Runs only when the admin is framed. `target="_top"` is then replaced with a new
 * tab, opened from the click itself so it counts as a user gesture and is not
 * popup-blocked, and the admin reloads once that window is dismissed so the
 * session cookies the callback set are picked up. If even that window cannot be
 * opened, the sign-in proceeds in this frame rather than doing nothing at all.
 *
 * The listener is delegated on `document` with capture, because the anchor belongs
 * to Keystatic's own tree and cannot be reached with a ref.
 */
function useEmbeddedSignIn() {
  useEffect(() => {
    // Comparing the two window references is safe across origins; reading
    // properties off `window.top` would not be.
    if (window.self === window.top) return;

    let signInWindow: Window | null = null;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest(`a[href*="${SIGN_IN_HREF}"]`);
      if (!(anchor instanceof HTMLAnchorElement)) return;

      event.preventDefault();
      const href = anchor.href;
      try {
        signInWindow = window.open(href, '_blank');
      } catch {
        signInWindow = null;
      }
      if (!signInWindow) window.location.assign(href);
    };

    const onFocus = () => {
      if (!signInWindow) return;
      // The sign-in window has been left — by finishing, or by being closed.
      // Either way the cookies are on this origin now, so the dashboard can load.
      signInWindow = null;
      window.location.reload();
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}

/**
 * Log what GitHub's API says, because that is where a session is really decided.
 *
 * The token exchange succeeding does not authorise anything: the dashboard then
 * queries `api.github.com` with the token it was given, and GitHub's refusal —
 * `401 Bad credentials`, `403 Resource not accessible by integration`, or a
 * GraphQL `errors` array inside an otherwise 200 reply — is what sends the reader
 * back to the login screen. That request is made from the BROWSER, so the server
 * cannot see the answer; this records it in the browser's own console, where the
 * dashboard's errors are otherwise invisible.
 *
 * Only failures are recorded (a non-2xx, or a body carrying GraphQL errors), the
 * body is redacted with the same rules the server uses, and the wrapped fetch is
 * restored when the admin unmounts. Reading the body clones the response first,
 * so nothing Keystatic does is affected.
 */
function useGithubApiCapture() {
  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await original(input, init);
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (isGithubApiRequest(url)) {
          const body = await response.clone().text();
          if (response.status >= 400 || body.includes('"errors"')) {
            const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
            console.error(
              `[keystatic] GitHub API ${status} for ${url.split('?')[0]} — ${redactSecrets(body.slice(0, 800))}`
            );
          }
        }
      } catch {
        // Recording must never break the dashboard it is recording.
      }
      return response;
    };

    return () => {
      window.fetch = original;
    };
  }, []);
}

export default function KeystaticAdmin() {
  useEmbeddedSignIn();
  useGithubApiCapture();
  return <Admin />;
}
