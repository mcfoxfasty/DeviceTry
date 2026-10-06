# The DeviceTry CMS

Articles are written in an admin dashboard at **`/keystatic`**, backed by
[Keystatic](https://keystatic.com) in **GitHub mode**. Publishing an article is a
commit to this repository: the Markdown file and every uploaded image are written
through the GitHub API, so text, assets and the code that renders them are
reviewed and versioned together.

## What lives where

| Path | What it is |
| --- | --- |
| `keystatic.config.ts` | The schema: every field an article has, and the editor's capabilities. The single source of truth. |
| `content/posts/<slug>.md` | One article per file: YAML front matter, then the Markdown body. |
| `public/images/posts/` | Cover images and inline images uploaded through the CMS. |
| `lib/blog/content.ts` | The read side: turns the collection into typed posts for the site. |
| `lib/blog/seo.ts` | Canonical, Open Graph, Twitter and Article JSON-LD, as pure functions. |
| `app/blog/` | The public blog index and the article page. |
| `app/keystatic/…`, `app/api/keystatic/…` | The admin UI and its server side. |
| `tests/blogCms.test.ts` | Guards for the schema, the SEO, and the alt-text rule. |

## Required environment variables

GitHub mode needs a **GitHub App** with read/write access to this repository.
The first visit to `/keystatic` walks through creating it and prints four values:

```
KEYSTATIC_GITHUB_CLIENT_ID
KEYSTATIC_GITHUB_CLIENT_SECRET
KEYSTATIC_SECRET
NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG
```

Set them in the deployment environment (Settings → Environment) and in the
sandbox's `.env.local` if you want to use the CMS from the workspace preview.
Never commit them. When the App's callback URL needs adding or changing, see the
"Add redirect_uri" section of Keystatic's GitHub-mode documentation.

`NEXT_PUBLIC_SITE_URL` is required separately at deploy time (see
`lib/site.ts`); canonical and Open Graph URLs are built from it.

## The deployment constraint that matters

Keystatic's admin is the one part of this site that is genuinely dynamic — it
exchanges an OAuth code for a token and then commits to GitHub — so **the host
must be able to run its API routes under Node.js**. Everything else stays static.
`app/api/keystatic/[...params]/route.ts` is that server side; if it cannot run on
a given host, the public site is unaffected but `/keystatic` will not authenticate.

## Publishing, and why an article needs a build

The site is statically prerendered, including `/blog/<slug>`. Publishing commits
the article, and the next build turns it into a page. `app/blog/[slug]/page.tsx`
sets `dynamicParams = false` so a slug that no build has seen returns 404 rather
than being rendered on demand — on an edge runtime, an MDX compiler at request
time is not something to rely on. Wire a deploy to the repository's push event if
you want publishing to feel immediate.

## The article schema

Main content: an article title (which is also the default URL slug) and a rich
body — H2/H3/H4, bold, italic, strikethrough, inline code, lists, blockquotes,
code blocks, tables, dividers, and internal or external links.

Inline images are uploaded into the repository and **require alt text**; the
caption is optional and renders as a visible `<figcaption>`. A cover image and a
separate required cover alt text are what Open Graph, Twitter and the article
lead use.

SEO and social: a custom SEO meta title, a meta description, publish date, author,
a category from the site's existing taxonomy, free-form tags, and an optional
canonical URL override for an article first published elsewhere.

## Rules the build enforces

`bun run test` fails if any published article ships an image without alt text, or
is missing its cover image, its cover alt text, its date or its author. Those are
the checks that keep a CMS from quietly degrading a page's accessibility and
search metadata over time.

## Signing in, on a phone and in an embedded browser

**The sign-in is a full-page redirect, not a popup.** GitHub mode renders an
anchor to `/api/keystatic/github/login` with `target="_top"`; the server answers
`307` to `github.com/login/oauth/authorize`; the return trip lands on
`/api/keystatic/github/oauth/callback`, which sets the session cookies and
redirects to the dashboard. Nothing in the flow waits on `window.opener` or a
`postMessage` handshake — the one cross-window signal is a `storage` event
(`ks-refetch-installations`) fired by the install-completion page — so there is no
popup fallback to configure and no `keystatic.config.ts` option that could choose
one. `components/keystatic/KeystaticAdmin.tsx` adds a single fallback for the case
that does break: when the admin is inside a cross-origin frame, `target="_top"`
can be blocked, so the sign-in continues in a new tab and the admin reloads when
that tab is dismissed. On an ordinary top-level page the fallback is inert.

## When a sign-in fails: reading the reason

Keystatic answers every refusal with two words — `Authorization failed` — and
GitHub reports a rejected **token exchange** with HTTP 200 and an error body, so
the reason is invisible by default. The callback is therefore instrumented
(`lib/keystatic/oauthDiagnostics.ts`):

1. GitHub declining *before* any exchange (`redirect_uri_mismatch`,
   `access_denied`, …) is logged together with its `error_description`.
2. The reply from `github.com/login/oauth/access_token` is recorded, **redacted**
   and logged — access tokens, refresh tokens, client secrets and authorization
   codes are replaced with `[redacted]` before anything is written, in the log or
   in the response.
3. That explanation is appended to the failing response, so the device that hit
   the failure shows the reason instead of two words. The status Keystatic chose
   is preserved.

Where to read it: the Cloudflare Worker log (`wrangler tail`, or the Workers log
stream), the `next start` output in the workspace preview, and the response body
in the browser tab the callback landed in. All three carry the same lines, tagged
`[keystatic]`.

The common `200`-with-error-body reasons are `bad_verification_code` (the
authorization code was already used — a browser that opened the callback twice
does this) and `incorrect_client_credentials` (the App does not match the
credentials bound to the deployment).

## After the exchange: the token has to work too

A `200` from the token endpoint means GitHub issued a token, not that the token
can do anything. Keystatic's dashboard then queries `api.github.com` from the
browser with that token, and a refusal there (`401 Bad credentials`, `403
Resource not accessible by integration`, or a GraphQL `errors` array inside an
otherwise `200` reply) returns the reader to the login screen with nothing said.
Two captures cover it:

- **Server.** Straight after a callback that succeeded, the token it just issued
  is used against `GET /user` and `GET /repos/mcfoxfasty/DeviceTry`, and both
  replies are logged with the fields that decide access — including
  `permissions.push`, which is what authorises a commit from the dashboard. If the
  callback redirects without setting the access-token cookie, that is logged too,
  because then the browser has no session to use.
- **Browser.** `components/keystatic/KeystaticAdmin.tsx` records GitHub API
  refusals in the console, redacted, since that request never passes through this
  site's server.

**The 401 on `/api/keystatic/github/refresh-token`.** That is Keystatic's session
probe, and it returns `401` in four unrelated situations. The probe now examines
the refresh-token cookie and says which one applies: no cookie on the request (the
browser asking is not the one that signed in, or a `Secure` cookie was dropped by
a plain-http host that is not localhost); no secret resolved; a secret shorter
than the 32 characters Keystatic needs to derive its key; or a cookie that cannot
be decrypted with the current `KEYSTATIC_SECRET` (a rotated secret, or two
environments with different values — sign in again in that browser).

