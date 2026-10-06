# The DeviceTry CMS

Articles are written in an admin dashboard at **`/admin`**. Publishing an article
is a commit to this repository: the Markdown file and every uploaded image are
written with the GitHub REST API, so an article's text, its assets and the code
that renders them are reviewed and versioned together.

## What lives where

| Path | What it is |
| --- | --- |
| `app/admin/page.tsx` | The dashboard. Server-guarded: without a session cookie the editor's markup is never sent. |
| `app/admin/login/page.tsx` | The sign-in form: a plain `<form method="post">`, no client JavaScript. |
| `app/api/admin/login/route.ts` | Password check, session cookie. |
| `app/api/admin/logout/route.ts` | Clears the cookie. |
| `app/api/admin/publish/route.ts` | Receives the article and its images, authenticates, validates, commits. |
| `components/admin/ArticleEditor.tsx` | The editor and the SEO sidebar. |
| `lib/admin/session.ts` | The cookie: how it is derived, and why it needs no session store. |
| `lib/admin/authoring.ts` | Draft validation and the exact file format `/blog` reads. |
| `lib/admin/markdown-editing.ts` | The toolbar's operations, as pure functions. |
| `lib/admin/github.ts` | The contents API client: `PUT /repos/{owner}/{repo}/contents/{path}`. |
| `keystatic.config.ts` | The article schema — every field, the categories, the image paths and the editor's capabilities. Still the single source of truth. |
| `content/posts/<slug>.md` | One article per file: YAML front matter, then the Markdown body. |
| `public/images/posts/` | Cover images and inline images uploaded through the dashboard. |
| `lib/blog/content.ts` | The read side: turns the collection into typed posts for the site. |
| `lib/blog/seo.ts` | Canonical, Open Graph, Twitter and Article JSON-LD, as pure functions. |
| `app/blog/` | The public blog index and the article page. |
| `tests/blogCms.test.ts` | Guards for the schema and the SEO. |
| `tests/adminDashboard.test.ts` | Guards for the dashboard: auth, alt text, the file format, the publish order. |

## Required environment variables

| Variable | What it is |
| --- | --- |
| `ADMIN_PASSWORD` | The dashboard password. Falls back to the documented default `MySecretPass2026!` when unset — the login page says so while that is true. Set it. |
| `GITHUB_TOKEN` | A token with **Contents: read and write** on `mcfoxfasty/DeviceTry`. Publishing is impossible without it, and `/api/admin/publish` says so by name rather than failing silently. |
| `NEXT_PUBLIC_SITE_URL` | Required separately at deploy time (see `lib/site.ts`); canonical and Open Graph URLs are built from it. |

Set them in the deployment environment and in the workspace's `.env.local` if you
want to publish from the preview. Never commit them. For the Cloudflare Worker the
same values are bound as secrets:

```sh
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put GITHUB_TOKEN
```

Changing `ADMIN_PASSWORD` invalidates every signed-in session immediately: the
cookie is an HMAC of a fixed label keyed by the password, so a new password simply
stops matching old cookies. That is the whole revocation mechanism.

## What replaced Keystatic's admin

The dashboard used to be Keystatic's OAuth admin at `/keystatic`. It needed a
GitHub App, four secrets, an OAuth round trip through `github.com`, and a callback
URL registered per origin — and it could still leave the browser on the login
screen after a *successful* token exchange. `/admin` needs one password and one
token, has no third party in the sign-in path, and has no redirect that a host can
get wrong. The old routes (`app/keystatic/…`, `app/api/keystatic/…`,
`components/keystatic/…`, `lib/keystatic/…`) are deleted, and a test asserts they
stay deleted.

Keystatic itself remains, in a smaller role: `@keystatic/core`'s reader parses
`content/posts/*` for the site's pages, and `keystatic.config.ts` is the schema both
the reader and the dashboard publisher are written against. `@keystatic/next` — the
package that served the removed admin — is no longer imported anywhere. The old
`KEYSTATIC_GITHUB_*` and `KEYSTATIC_SECRET` environment variables are unused and can
be deleted.

## Signing in

One password field, one cookie. The cookie is `HttpOnly` (no script can read it),
`SameSite=Lax` (a cross-site form post cannot use it), `Secure` in production, and
expires after 12 hours. The password is compared in constant time, and a wrong
attempt reveals nothing beyond "that was not it".

The sign-in form is a native form post with no client JavaScript, which is what
makes it reliable on a phone: iOS Safari and in-app browsers submit it without a
hydration step, without a popup and without a redirect to a third party, and a
password manager can fill it in.

## The editor

The body is a Markdown textarea with a toolbar, not a `contenteditable` widget. The
toolbar offers H2/H3/H4, bold, italic, strikethrough, inline code, bulleted and
numbered lists, blockquotes, links, tables, fenced code blocks and dividers, and
every button's operation is a pure function with a test. What the author writes is
exactly what is committed — there is no serializer between the two.

The SEO sidebar carries the article title (which drives the slug until the author
takes the slug over), the URL slug, the SEO meta title, the SEO meta description,
the cover image, the cover alt text, the publish date, the author, the category
(from the site's existing taxonomy), free-form tags, and an optional canonical URL
override.

Drafts are saved to `localStorage` on every change and restored on load, so a phone
that discards a background tab does not cost the author an article. Uploaded images
are deliberately not saved there.

## Rules the dashboard enforces

**Alt text is required, and "required" means something.** An image cannot be
inserted without alt text, the cover image cannot be published without it, and the
publish endpoint re-checks both on the server — a form is a convenience, the
endpoint is the guarantee. Alt text shorter than 8 characters, or with no letters
in it, is refused: `a.png` and `...` would pass a non-empty check and describe
nothing.

The draft rules the schema requires — title length, a lowercase dashed slug, a
non-empty body, a cover image, a `YYYY-MM-DD` date, an author, a known category, at
most 12 tags, an absolute canonical override — are enforced in the editor and again
in `/api/admin/publish`. `bun run test` additionally fails if a published article
ships an image without alt text or is missing its cover, date or author.

## Publishing, and why an article needs a build

The endpoint commits the article's images first and then
`content/posts/{slug}.md`, on `main`. Images go first because the Markdown links
them at their final public paths: if the article landed first, a build between the
two commits would publish an article whose images 404. An edit reads the file's
current `sha` before writing, which is what the contents API requires to overwrite
instead of answering `409`.

The site is statically prerendered, including `/blog/<slug>`. Publishing commits
the article, and the next build turns it into a page. `app/blog/[slug]/page.tsx`
sets `dynamicParams = false`, so a slug that no build has seen returns 404 rather than
being rendered on demand — on an edge runtime, an MDX compiler at request time is
not something to rely on. Wire a deploy to the repository's push event if you want
publishing to feel immediate.

## When publishing fails

`/api/admin/publish` answers with GitHub's own words: a `401` names the token, a
`403` points at the missing **Contents: write** permission or the rate limit, a
`404` at the repository or branch, and a `409` tells you to publish again so the new
version of the file is read. The dashboard shows that sentence verbatim, because
"401 Bad credentials" is actionable and "publish failed" is not.
