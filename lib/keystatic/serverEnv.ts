import { getCloudflareContext } from '@opennextjs/cloudflare/cloudflare-context';

/**
 * Where the CMS's three server-side credentials come from, in each runtime this
 * site runs in.
 *
 * THE PROBLEM THIS FILE SOLVES.
 * Keystatic reads its credentials — KEYSTATIC_GITHUB_CLIENT_ID,
 * KEYSTATIC_GITHUB_CLIENT_SECRET and KEYSTATIC_SECRET — out of `process.env` at
 * the moment the API route handler is constructed. That is right for the local
 * preview, where the workspace environment is ambient in every process, and
 * wrong on the Cloudflare Worker: with the OpenNext adapter the Worker's
 * bindings arrive on the request context, and `process.env` does not carry them.
 * The symptom was a 503 from app/api/keystatic/[...params]/route.ts naming all
 * three keys as missing even though they were set in the Cloudflare dashboard.
 *
 * THE ORDER, AND WHY IT IS THIS ORDER.
 * 1. `process.env` — the runtimes where the environment genuinely is ambient
 *    (the local preview, any Node host). Consulting it first leaves that path
 *    exactly as it was, with no adapter involved.
 * 2. `getCloudflareContext().env` — the adapter's accessor for Worker bindings.
 *    It is reached only when `process.env` has nothing, and it is called
 *    defensively: outside a Worker there is no context and the accessor throws,
 *    which is expected here rather than an error.
 *
 * WHY THE VALUES ARE PASSED EXPLICITLY INSTEAD OF COPIED INTO `process.env`.
 * `APIRouteConfig` already accepts `clientId`, `clientSecret` and `secret` and
 * only falls back to `process.env` when they are absent, so the credentials are
 * supplied where Keystatic looks for them rather than written into a global the
 * runtime owns.
 *
 * `pickCredentials` is pure so precedence can be tested without a Worker, and
 * `workerBindings` is exported separately so the adapter lookup can be exercised
 * by putting a context on the global scope.
 *
 * NOT HERE: NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG. That one is public and is
 * inlined into the bundle at build time, so it is a build input rather than a
 * runtime binding — see docs/cms.md.
 */

/** Credential name → the environment variable Keystatic would otherwise read. */
export const KEYSTATIC_CREDENTIALS = {
  clientId: 'KEYSTATIC_GITHUB_CLIENT_ID',
  clientSecret: 'KEYSTATIC_GITHUB_CLIENT_SECRET',
  secret: 'KEYSTATIC_SECRET',
} as const;

export type KeystaticCredential = keyof typeof KEYSTATIC_CREDENTIALS;
export type KeystaticCredentials = Partial<Record<KeystaticCredential, string>>;

/** An environment-like object: variables, but also non-string Worker bindings. */
type EnvSource = Record<string, unknown> | undefined;

/**
 * A credential is usable only when it is a non-empty string.
 *
 * A Worker binding can also be a KV namespace, a Durable Object or any other
 * non-string value, and a blank secret is a misconfiguration that would
 * otherwise surface much later as an unintelligible GitHub 401 instead of here.
 * Trimming is deliberate: a value pasted with a trailing newline is otherwise a
 * different secret than the one GitHub holds.
 */
function usable(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Precedence, stated once: `fromProcess` wins and `fromWorker` fills the gaps.
 *
 * A credential absent from both sources is simply left out of the result, and an
 * incomplete result is what makes Keystatic throw while building the handler —
 * so the route answers its readable 503 instead of starting an OAuth flow with
 * half a configuration.
 */
export function pickCredentials(fromProcess: EnvSource, fromWorker: EnvSource): KeystaticCredentials {
  const picked: KeystaticCredentials = {};
  for (const name of Object.keys(KEYSTATIC_CREDENTIALS) as KeystaticCredential[]) {
    const variable = KEYSTATIC_CREDENTIALS[name];
    const value = usable(fromProcess?.[variable]) ?? usable(fromWorker?.[variable]);
    if (value !== undefined) picked[name] = value;
  }
  return picked;
}

/**
 * The Worker's bindings, or `undefined` when this process is not a Worker.
 *
 * Under `next start` and `next dev` the adapter's context was never installed,
 * and the accessor throws a message about `initOpenNextCloudflareForDev`. That
 * is the normal state of the local preview, where `process.env` is the source of
 * truth, so the throw is caught here and reported as "no Worker bindings"
 * rather than allowed to escape into the request.
 */
export function workerBindings(): EnvSource {
  try {
    // `CloudflareEnv` declares a fixed set of optional properties — Fetchers,
    // KV namespaces, strings — rather than an index signature, so it cannot be
    // assigned to a map directly. The narrowing is what lets one lookup handle
    // variables and bindings alike; `usable` still rejects anything that is not
    // a real string at runtime.
    return getCloudflareContext().env as unknown as EnvSource;
  } catch {
    return undefined;
  }
}

/** The credentials to hand Keystatic, whichever runtime this happens to be. */
export function resolveKeystaticCredentials(): KeystaticCredentials {
  return pickCredentials(process.env, workerBindings());
}

/**
 * `KEYSTATIC_SECRET` alone, for the one caller that needs it without the rest.
 *
 * The secret is what Keystatic encrypts its refresh-token cookie with, so a
 * cookie from a deployment holding a different secret cannot be decrypted on the
 * way back in — a failure Keystatic reports as a bare 401. The diagnostics in
 * lib/keystatic/oauthDiagnostics.ts use this to tell that case apart from "this
 * browser never had a session", which a bare 401 cannot distinguish.
 *
 * Resolved per call, exactly like `resolveKeystaticCredentials`, so nothing about
 * a Worker's bindings is pinned outside a request.
 */
export function keystaticSecret(): string | undefined {
  return resolveKeystaticCredentials().secret;
}
