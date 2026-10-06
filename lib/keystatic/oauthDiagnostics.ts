/**
 * Making a failed CMS sign-in explain itself, and letting a phone finish it.
 *
 * THE BUG THIS EXISTS FOR.
 * When GitHub refuses a token exchange, Keystatic's callback collapses every
 * reason into one sentence — "Authorization failed" — for three different
 * failures, and it never logs what GitHub actually said:
 *
 *     if (!tokenRes.ok) return { status: 401, body: 'Authorization failed' };
 *     ...
 *     try { tokenData = tokenDataResultType.create(await tokenRes.json()); }
 *     catch { return { status: 401, body: 'Authorization failed' }; }
 *
 * Note the second one: GitHub answers a rejected exchange with **HTTP 200** and a
 * body like `{"error":"bad_verification_code"}`. Nothing is wrong at the HTTP
 * level, so every generic reason ends up in the same place, and an operator on a
 * phone sees only those two words with no way to learn more.
 *
 * So the callback is instrumented here: the reply from GitHub's token endpoint is
 * captured, redacted, logged to the server console (Worker log / `wrangler tail` /
 * `next start` output) and — when the request failed — appended to the response
 * the browser shows, which is what makes the failure diagnosable from the device
 * that hit it.
 *
 * WHAT IS DELIBERATELY NOT LOGGED.
 * An access token, a refresh token, a client secret or an authorization code in a
 * log is a credential leak, and those logs are visible to anyone with access to
 * the hosting dashboard. Every value is redacted to `[redacted]` before it
 * reaches `console` or the response body, and the capture never stores the
 * credentials Keystatic sends — it reads the reply, which is the part that
 * carries the reason.
 *
 * About `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`: not here. It is public and is
 * inlined at build time, so it is a build input, not a runtime binding.
 */

/** The path Keystatic's OAuth callback is served from. */
export const CALLBACK_PATH = '/api/keystatic/github/oauth/callback';

/** The tail of the path, checked with `endsWith` so a basePath cannot slip past it. */
const CALLBACK_SUFFIX = '/github/oauth/callback';

/** The one endpoint whose reply decides whether a sign-in completes. */
export const TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';

/** The line Keystatic's `?state=close` page calls to close the window it is in. */
const CLOSE_CALL = 'window.close();';

/** Marks that page as Keystatic's install-completion page rather than any HTML. */
const CLOSE_MARKER = 'ks-refetch-installations';

/** Query parameters whose values are secrets. */
const SECRET_NAMES = ['access_token', 'refresh_token', 'client_secret', 'code', 'code_verifier'];

/**
 * Replace every secret value with a fixed marker.
 *
 * Both shapes are handled because GitHub answers this endpoint either in JSON
 * (`"access_token":"…"`) or as a form-encoded body (`access_token=…`), and the
 * error fields sit alongside the tokens in both.
 */
export function redactSecrets(text: string): string {
  let out = text;
  for (const name of SECRET_NAMES) {
    out = out.replace(new RegExp(`(${name}=)[^&\\s"']+`, 'gi'), '$1[redacted]');
    out = out.replace(new RegExp(`("${name}"\\s*:\\s*")[^"]*(")`, 'gi'), '$1[redacted]$2');
  }
  return out;
}

/** True for the OAuth callback, whatever the site is mounted under. */
export function isCallbackPath(pathname: string): boolean {
  return pathname === CALLBACK_PATH || pathname.endsWith(CALLBACK_SUFFIX);
}

/**
 * What GitHub itself said when it declined, or `null` when it did not decline.
 *
 * GitHub reports a refusal by redirecting back with `error` and a human-readable
 * `error_description` — `redirect_uri_mismatch`, `access_denied`,
 * `bad_verification_code` and so on. That is the whole explanation for the class
 * of failures where no token exchange is even attempted, because Keystatic's
 * callback checks `error_description` first and never calls its token exchange.
 *
 * Takes a minimal `get` interface so the formatting can be exercised from tests.
 */
export function describeCallbackError(params: { get(name: string): string | null }): string | null {
  const error = params.get('error');
  const description = params.get('error_description');
  const documentation = params.get('error_uri');
  if (!error && !description) return null;

  const parts = [
    `error=${error ?? '(none given)'}`,
    description ? `description=${description}` : null,
    documentation ? `documentation=${documentation}` : null,
    // Whether an authorization code arrived separates "GitHub refused before we
    // could exchange anything" from "the exchange itself was rejected".
    `authorization code: ${params.get('code') ? 'present' : 'absent'}`,
  ].filter(Boolean);

  return redactSecrets(parts.join(' | '));
}

/** The token endpoint, with and without a query string. */
export function isTokenEndpoint(url: string): boolean {
  return url.startsWith(TOKEN_ENDPOINT);
}

/** One line for a GitHub token-endpoint reply, redacted and bounded. */
export function summarizeTokenExchange(status: number, statusText: string, body: string): string {
  const trimmed = body.trim();
  const detail = trimmed.length > 0 ? redactSecrets(trimmed.slice(0, 600)) : '(empty body)';
  return `${status}${statusText ? ` ${statusText}` : ''} — ${detail}`;
}

/** Run something while recording GitHub's replies to the token endpoint. */
export async function captureTokenExchange<T>(
  run: () => Promise<T>
): Promise<{ result: T; exchanges: string[] }> {
  const original = globalThis.fetch;
  const exchanges: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await original(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (isTokenEndpoint(url)) {
      // Cloned before Keystatic reads the body: reading the original would
      // consume it and break the sign-in this is meant to explain.
      const body = await response.clone().text().catch(() => '');
      exchanges.push(summarizeTokenExchange(response.status, response.statusText, body));
    }
    return response;
  }) as typeof fetch;

  try {
    return { result: await run(), exchanges };
  } finally {
    // Restored on every path, including a throw, so a captured request can never
    // leave the runtime with an instrumented global fetch.
    globalThis.fetch = original;
  }
}

/**
 * The explanation to show alongside a failure, or `null` when there is nothing
 * to add to what Keystatic already said.
 */
export function explainFailure(
  status: number,
  exchanges: string[],
  callbackError: string | null
): string | null {
  if (!callbackError && exchanges.length === 0) return null;

  const lines = [`The CMS sign-in failed with HTTP ${status}.`, ''];

  if (callbackError) {
    lines.push(`GitHub declined the request before any token exchange: ${callbackError}`, '');
  }

  if (exchanges.length > 0) {
    lines.push('Reply from GitHub to the token exchange:');
    for (const exchange of exchanges) lines.push(`  ${exchange}`);
    lines.push(
      '',
      'A 200 that still fails is normal: GitHub answers a rejected exchange with' +
        ' an error body rather than an error status. The usual reasons are' +
        ' bad_verification_code (the authorization code was already used — a' +
        ' browser that opened the callback twice does this), incorrect_client_credentials' +
        ' (the App does not match these credentials) and redirect_uri_mismatch.',
    );
  }

  return lines.join('\n');
}

/**
 * Append the explanation to a failed plain-text response.
 *
 * Only plain-text bodies and only failures: a success has nothing to explain, and
 * Keystatic's `?state=close` page is HTML that must stay valid.
 */
export async function withFailureDetail(response: Response, detail: string | null): Promise<Response> {
  if (!detail || response.status < 400) return response;
  const type = response.headers.get('content-type') ?? '';
  if (type && !type.includes('text/plain')) return response;

  const body = await response.text().catch(() => '');
  return new Response(`${body}\n\n---\n${detail}\n`, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}

/**
 * Let a window that scripts cannot close still finish the sign-in.
 *
 * Keystatic's `?state=close` page exists to be opened in a separate window: it
 * flags the main tab that the GitHub App installation changed and then calls
 * `window.close()`. `window.close()` only works on a window a script opened, so a
 * page reached in a normal tab — which is the normal outcome on iOS Safari and in
 * an in-app browser, where popups are suppressed — leaves the reader on a blank
 * page with no way forward. The rewrite keeps the close attempt and adds a
 * same-tab continuation for exactly that case.
 *
 * The cross-tab handshake itself is a `storage` event on `ks-refetch-installations`,
 * which needs no `window.opener` — that is why this is a continuation, not a fix
 * for lost messaging.
 */
export function resumeAfterClose(html: string): string {
  if (!html.includes(CLOSE_MARKER) || !html.includes(CLOSE_CALL)) return html;
  const resume =
    "try{window.close()}catch(e){}" +
    "setTimeout(function(){if(!window.closed){location.replace('/keystatic')}},700);";
  return html.replace(CLOSE_CALL, resume);
}

// ---------------------------------------------------------------- verification
// A successful token exchange is NOT the end of the story: Keystatic then uses
// that token against GitHub's API, and when GitHub refuses the token the admin
// ends up back at "Log in with GitHub" with nothing said about why. These
// helpers answer the two questions that decides: does the token this deployment
// just minted actually work, and what does GitHub say about it.

/** GitHub's REST API, the host Keystatic's dashboard also queries directly. */
export const GITHUB_API = 'https://api.github.com';

/** Keystatic's session probe — the 401 the admin makes on every page load. */
export const REFRESH_PATH = '/api/keystatic/github/refresh-token';

/** How long a refresh-token cookie can be, in the format Keystatic writes. */
const REFRESH_SALT_LENGTH = 16;
const REFRESH_IV_LENGTH = 12;

/** An absolute URL from anything fetch() accepts. */
export function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === 'object' && 'url' in input) return String((input as { url: unknown }).url);
  return '';
}

/** True for a request to GitHub's API, wherever it is made from. */
export function isGithubApiRequest(url: string): boolean {
  return url.startsWith(GITHUB_API) || url.includes('://api.github.com/');
}

/** True for Keystatic's session probe. */
export function isRefreshPath(pathname: string): boolean {
  return pathname === REFRESH_PATH || pathname.endsWith('/github/refresh-token');
}

/** `owner/name` from either shape Keystatic accepts for `storage.repo`. */
export function repoSlug(repo: string | { owner: string; name: string }): string {
  return typeof repo === 'string' ? repo : `${repo.owner}/${repo.name}`;
}

/**
 * The requests that answer "is this token actually usable, and can it see the
 * repository this CMS writes to?".
 *
 * `/user` proves the token itself is accepted by GitHub. `/repos/{owner}/{name}`
 * is the one that matters for the CMS: its reply carries the `permissions` block
 * — `push: true` is what authorises a commit from the dashboard. GitHub's API
 * treats owner and repository names case-insensitively, so a casing difference
 * does not fail here, but the exact slug is still what gets logged.
 */
export function verificationRequests(repo: string): string[] {
  const slug = repo.trim();
  return [`${GITHUB_API}/user`, `${GITHUB_API}/repos/${slug}`];
}

/**
 * The interesting part of a GitHub REST body, redacted and bounded.
 *
 * A full repository object is thousands of characters and buries the answer, so
 * the fields that decide access are picked out and the rest dropped. An error
 * reply (`message`, `documentation_url`) is kept whole — that is the reason.
 */
export function summarizeGithubReply(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return '(empty body)';
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const key of ['message', 'documentation_url', 'login', 'id', 'full_name', 'private', 'permissions']) {
      if (parsed[key] !== undefined) picked[key] = parsed[key];
    }
    if (Object.keys(picked).length > 0) return redactSecrets(JSON.stringify(picked));
  } catch {
    // Not JSON: fall through to the raw text, which is itself the answer.
  }
  return redactSecrets(trimmed.slice(0, 600));
}

/** One `request → reply` line, never containing the token that was sent. */
export function summarizeApiCall(url: string, status: number, statusText: string, body: string): string {
  return `${status}${statusText ? ` ${statusText}` : ''} ${url} — ${summarizeGithubReply(body)}`;
}

/**
 * Ask GitHub what the freshly minted access token can do.
 *
 * Called right after a callback that succeeded, on the server, where the token is
 * in hand and the answer can be logged even though the browser only ever sees a
 * redirect. `request` is injectable so the whole thing can be exercised without
 * touching the network.
 */
export async function verifyAccessToken(
  accessToken: string,
  repo: string,
  request: typeof fetch = fetch
): Promise<string[]> {
  const lines: string[] = [];
  for (const url of verificationRequests(repo)) {
    try {
      const response = await request(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/vnd.github+json',
          'user-agent': 'devicetry-cms',
        },
      });
      const body = await response.text().catch(() => '');
      lines.push(summarizeApiCall(url, response.status, response.statusText, body));
    } catch (error) {
      // No reply at all — a network or Worker egress failure, which is a
      // different problem from GitHub refusing the token.
      lines.push(`no reply from ${url} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return lines;
}

/** The cookies a response is setting, as a name → value map. */
export function cookiesFromResponse(headers: Headers): Map<string, string> {
  const jar = new Map<string, string>();
  // `getSetCookie` is the standard accessor and exists on Node 18.14+ and in
  // Workers; the single-header fallback covers a runtime that only exposes the
  // combined form.
  const list =
    typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') ?? ''].filter(Boolean);
  for (const entry of list) {
    const pair = entry.split(';')[0] ?? '';
    const equals = pair.indexOf('=');
    if (equals === -1) continue;
    jar.set(pair.slice(0, equals).trim(), pair.slice(equals + 1).trim());
  }
  return jar;
}

/** The access token a callback response is handing the browser, or `null`. */
export function accessTokenFromResponse(response: Response): string | null {
  return cookiesFromResponse(response.headers).get('keystatic-gh-access-token') ?? null;
}

/** The value of one cookie in a request's `Cookie` header, or `null`. */
export function cookieFromRequest(header: string | null, name: string): string | null {
  for (const entry of (header ?? '').split(';')) {
    const equals = entry.indexOf('=');
    if (equals === -1) continue;
    if (entry.slice(0, equals).trim() === name) return entry.slice(equals + 1).trim();
  }
  return null;
}

/** Decode Keystatic's base64url, as its own reader does. */
function base64UrlBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
}

/**
 * Whether this deployment can decrypt the refresh-token cookie it was given.
 *
 * Keystatic encrypts that cookie with `KEYSTATIC_SECRET` (HKDF-SHA256, then
 * AES-GCM) and reports a failure to decrypt as a bare 401 — indistinguishable
 * from having no cookie at all. Repeating the derivation here separates the two
 * cases, which are fixed in completely different ways: one by signing in again in
 * this browser, the other by making the environment's secret consistent.
 */
export async function refreshCookieStatus(
  cookie: string | null,
  secret: string | undefined
): Promise<'absent' | 'no-secret' | 'unreadable-secret' | 'ok' | 'undecryptable'> {
  if (!cookie) return 'absent';
  if (!secret) return 'no-secret';
  // Keystatic's own guard: a secret shorter than 32 characters cannot even
  // derive the key, so every cookie it wrote is unreadable here.
  if (secret.trim().length < 32) return 'unreadable-secret';

  try {
    const decoded = base64UrlBytes(cookie);
    const salt = decoded.slice(0, REFRESH_SALT_LENGTH);
    const iv = decoded.slice(REFRESH_SALT_LENGTH, REFRESH_SALT_LENGTH + REFRESH_IV_LENGTH);
    const value = decoded.slice(REFRESH_SALT_LENGTH + REFRESH_IV_LENGTH);
    if (value.length === 0) return 'undecryptable';

    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, [
      'deriveKey',
    ]);
    const derived = await crypto.subtle.deriveKey(
      { name: 'HKDF', salt, hash: 'SHA-256', info: new Uint8Array(0) },
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, derived, value);
    return 'ok';
  } catch {
    return 'undecryptable';
  }
}

/** Why a 401 from Keystatic's session probe happened, in one sentence. */
export function explainRefreshFailure(
  status: number,
  cookie: 'absent' | 'no-secret' | 'unreadable-secret' | 'ok' | 'undecryptable',
  exchanges: string[]
): string | null {
  if (status < 400) return null;

  const lines = [`Keystatic's session probe answered HTTP ${status}.`, ''];

  if (cookie === 'absent') {
    lines.push(
      'This request carried no keystatic-gh-refresh-token cookie, so there was no session to verify: the' +
        ' browser asking is not the one that completed the sign-in, or the cookie was never stored (a' +
        ' Secure cookie is dropped by a browser that reached the site over plain http on a host that is' +
        ' not localhost). GitHub was not asked anything.'
    );
  } else if (cookie === 'no-secret') {
    lines.push('A refresh cookie is present but this deployment resolved no KEYSTATIC_SECRET, so it cannot be read.');
  } else if (cookie === 'unreadable-secret') {
    lines.push(
      'A refresh cookie is present but KEYSTATIC_SECRET is shorter than the 32 characters Keystatic needs to' +
        ' derive its key, so no cookie it wrote can be read here.'
    );
  } else if (cookie === 'undecryptable') {
    lines.push(
      'A refresh cookie is present but cannot be decrypted with the KEYSTATIC_SECRET this deployment holds:' +
        ' the cookie was issued while a different secret was in use (a rotated secret, or two environments' +
        ' with different values). Sign in again in this browser to get a cookie matching the current secret.'
    );
  }

  if (exchanges.length > 0) {
    lines.push('', 'GitHub answered the refresh exchange:');
    for (const exchange of exchanges) lines.push(`  ${exchange}`);
  }

  return lines.join('\n');
}

/** Apply {@link resumeAfterClose} to an HTML response, leaving anything else alone. */
export async function withCloseFallback(response: Response): Promise<Response> {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) return response;

  const html = await response.text().catch(() => '');
  const rewritten = resumeAfterClose(html);
  if (rewritten === html) return response;

  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}
