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
