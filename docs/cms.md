# The DeviceTry CMS

Articles are written in an admin dashboard at **`/admin`**. Publishing an article
is a commit to this repository: the Markdown file and every uploaded image are
written with the GitHub REST API, so an article's text, its assets and the code
that renders them are reviewed and versioned together.

## What lives where

| Path | What it is |
| --- | --- |
| `app/admin/page.tsx` | The management view: every article, with Edit and Delete. Server-guarded — without a session cookie its markup is never sent. |
| `app/admin/new/page.tsx` | The editor for a new article. |
| `app/admin/edit/[slug]/page.tsx` | The editor loaded from a saved article. |
| `app/admin/login/page.tsx` | The sign-in form: a plain `<form method="post">`, no client JavaScript. |
| `app/api/admin/login/route.ts` | Password check, session cookie. |
| `app/api/admin/logout/route.ts` | Clears the cookie. |
| `app/api/admin/publish/route.ts` | `POST` saves an article and its images; `DELETE?slug=…` removes one. Both authenticate, validate, then commit. |
| `components/admin/ArticleEditor.tsx` | The editor, the Preview tab and the SEO sidebar. |
| `components/admin/ArticlesTable.tsx` | The management table, and the delete confirmation. |
| `lib/admin/preview.ts` | Markdown → HTML for the Preview tab, with every text run escaped. |
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
| `tests/blogCms.test.ts` | Guards for the schema, the SEO, and the published-only reads. |
| `tests/adminDashboard.test.ts` | Guards for the dashboard: auth, alt text, the file format, the publish order, delete, rename, preview and the status round trip. |

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
password manager can fill it in.## The article lifecycle

**`/admin` lists every article** in the collection — title, slug, publish date,
category and status — with a **+ New Article** button and an **Edit** and
**Delete** action per row. It is read at request time from `content/posts` through
the same reader the public pages use, so it shows the repository's truth rather
than a cached copy. A published row links to its public URL; a draft has none to
link to.

**Edit** (`/admin/edit/<slug>`) loads the saved file — front matter, body and
images — into the editor. Saving commits an update to **the same path**: the
contents API requires the file's current `sha`, so an edit overwrites rather than
duplicating. If the slug was changed, the old file is removed *after* the new one
lands: a rename, not a copy, so one article never exists at two URLs. If that
removal fails, the save still reports success and says what went wrong.

**Delete** asks *Are you sure you want to delete this article?* — a native
confirmation, which works identically on iOS Safari and cannot be dismissed by a
stray tap — and then calls `DELETE /api/admin/publish?slug=…`, which removes
`content/posts/<slug>.md` through the GitHub API. Deleting an article that is
already gone is reported as success, because the requested state is what exists.

**Status** is a field of the article, not a folder: `published`, `draft` or
`archived`, defaulting to `published`. Only `published` renders on the site — the
blog index, the article routes and the sitemap all read `listPublishedPosts`, so a
draft's URL is a 404 and it is never in the sitemap. The management table shows
all three states, which is the point of having them.

## The editor

The body is a Markdown textarea with a toolbar, not a `contenteditable` widget. The toolbar offers H2/H3/H4, bold, italic, strikethrough, inline code, bulleted and numbered lists, blockquotes, links, tables, fenced code blocks and dividers, and
every button's operation is a pure function with a test. What the author writes is
exactly what is committed — there is no serializer between the two.

A **Write / Preview** tab pair sits above the body. Preview renders the Markdown
with `lib/admin/preview.ts` — the constructs the toolbar writes, styled with the
same classes `components/blog/PostBody.tsx` uses — so an article can be checked
before it becomes a commit. It is a preview, not a second renderer to keep in
lockstep with the MDX compiler: everything outside the toolbar's set is shown as
plain text, and every text run is escaped, so nothing in a body can do more than
display.

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
non-empty body, a cover image, a `YYYY-MM-DD` date, an author, a known category, a
known status, at most 12 tags, an absolute canonical override — are enforced in the
editor and again in `/api/admin/publish`. `bun run test` additionally fails if a
published article ships an image without alt text or is missing its cover, date or
author.

An image the body references must be either part of the upload or **already in the
repository**: the first case is a new image, the second is an edit pointing at
images an earlier publish committed. The endpoint asks GitHub which one it is, so
a path that is neither is refused before anything is written — and an edit does not
have to re-upload the images its article already has.

## Publishing, and why an article needs a build

The endpoint commits the article's images first and then
`content/posts/{slug}.md`, on `main`. Images go first because the Markdown links
them at their final public paths: if the article landed first, a build between the
two commits would publish an article whose images 404. An edit reads the file's
current `sha` before writing, which is what the contents API requires to overwrite
instead of answering `409`.

A rename — the same save with a changed slug — commits the new file and then
deletes the old one. `DELETE /api/admin/publish?slug=…` does the second half on its
own, and skips the sha lookup's 404 as "already gone".

Drafts and archived articles are committed like anything else: the file is the
record, and its `status` decides whether the site renders it. Marking a published
article `draft` therefore unpublishes it on the next build, with no second edit and
no deletion.

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
