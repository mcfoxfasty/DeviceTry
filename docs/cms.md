# The DeviceTry CMS

Articles are written in an admin dashboard at **`/admin`**. Publishing an article
is a commit to this repository: the Markdown file and every uploaded image are
written with the GitHub REST API, so an article's text, its assets and the code
that renders them are reviewed and versioned together — and GitHub's push event is
what Cloudflare builds from.

## Two collections, one dashboard, one URL space

The site publishes two kinds of article and `public/guides` is the storage for both:

| Kind | Lives in | Written | Rendered by |
| --- | --- | --- | --- |
| **CMS article** | `public/guides/<slug>.md` | this dashboard | `components/blog/PostBody.tsx` (MDX, at build time) or `components/blog/PostBodyHtml.tsx` (read at request time) |
| **Typed guide** | `content/guides/<category>/<slug>.ts` | as source | `components/guides/GuideArticleView.tsx` |

Both are served from **`/guides/<slug>`**, listed on **`/guides`**, and in the
sitemap — from one registry, `lib/articles/registry.ts`, so neither can be missing
from one surface and present in another. `/blog` and `/blog/<slug>` are permanent
redirects (next.config.redirects.ts): every link, bookmark and search result from
before the merge keeps working, and a crawler is told where the content moved.

**A new CMS article does not wait for a build.** Every article the build knows is
prerendered; a slug the build has never seen is resolved from the repository (the
GitHub API, `lib/articles/registry.ts`), so an article published a minute ago has a
page at its URL and a card on `/guides` before the next deploy — which is why
`/guides` is rendered per request, merging the repository's published list into the
build's. An **edit** still reaches readers on the next build: a prerendered page
cannot be recalled at request time, and serving the new text at the article's URL
while the old text is still cached elsewhere would put two versions of one article
on the site at once. There is no index to update in either direction — the file is
the entry, and where it lives is what makes it a CMS article.

**`/admin` lists BOTH.** The management table reads the CMS collection and the typed
guides and shows them in one list, each row labelled with its source. That gap was a
real bug: the dashboard used to report the two Markdown articles while `/guides`
served eighteen pages, so the sixteen guides that get the most traffic could not be
edited, published, retired or deleted from it.

The typed guides are managed **where they live**, not converted:

- **Publish / Archive** flips the module's top-level `published` flag. That boolean
  is the whole of a guide's public visibility — the registry filters on it, which is
  what keeps a retired guide out of `/guides`, the sitemap and the static params.
  A guide cannot be a `draft`: the file has one flag and no third state, so the
  button is not offered rather than silently doing something else.
- **Edit** opens the module itself (`/admin/source/<slug>`) and commits it back.
  A typed guide's fields are not prose: its figures are registered assets that must
  exist at three widths, its sections drive the article template's tables and
  product boxes, its `proseLinks` are asserted against the prose by tests, and its
  FAQ set feeds the page's FAQPage graph. A conversion to Markdown would drop all of
  that and change a published page's structure.
- **Delete** detaches the module from `content/guides/index.ts` FIRST and removes
  the file second. The other order leaves an import of a missing file, which is a
  build failure rather than a missing article; this order leaves at worst an
  unreferenced module. A guide whose import the dashboard cannot find is refused
  outright.

A module the legacy reader cannot address — no `slug`, no `title`, no `published`
flag — is **named on the page** rather than omitted, because a row that silently
vanishes is how the old list hid most of the collection in the first place.

## What lives where

| Path | What it is |
| --- | --- |
| `app/admin/page.tsx` | The management view: every article in both collections, with its state and its actions. Server-guarded — without a session cookie its markup is never sent. |
| `app/admin/new/page.tsx` | The editor for a new article. |
| `app/admin/edit/[slug]/page.tsx` | The Markdown editor loaded from a saved CMS article. |
| `app/admin/source/[slug]/page.tsx` | The source editor for a typed guide module. |
| `app/admin/login/page.tsx` | The sign-in form: a plain `<form method="post">`, no client JavaScript. |
| `app/api/admin/login/route.ts` | Password check, session cookie. |
| `app/api/admin/logout/route.ts` | Clears the cookie. |
| `app/api/admin/publish/route.ts` | `POST` saves a CMS article and its images; `DELETE?slug=…&source=cms\|legacy` removes one from either collection. |
| `app/api/admin/status/route.ts` | `POST` publishes, drafts or archives one article, rewriting only the key that decides it. |
| `app/api/admin/source/route.ts` | `POST` commits a typed guide's module source. Looks the module up by slug — the request never names a file. |
| `components/admin/ArticleEditor.tsx` | The Markdown editor, the Preview and HTML / Source tabs, and the SEO sidebar. |
| `components/admin/SourceEditor.tsx` | The module editor for a typed guide. |
| `components/admin/ArticlesTable.tsx` | The management table: both collections, Edit / Publish / Archive / Draft / Delete, and the delete confirmation. |
| `lib/admin/collection.ts` | The union of the two readers, newest first. |
| `lib/admin/articles.ts` | The CMS read side: the collection, front matter and bodies, read from the repository through the GitHub API. |
| `lib/admin/legacy-guides.ts` | The typed-guide read side: the module collection, the `published` flip, and the index-aware delete. |
| `lib/admin/source-guard.ts` | What a saved module must keep — shared with the browser editor, and dependency-free so it can be. |
| `lib/admin/preview.ts` | Markdown → HTML for the Preview tab, with every text run escaped. |
| `lib/admin/html-to-markdown.ts` | HTML → Markdown for a rich paste and for the HTML / Source tab. |
| `lib/admin/session.ts` | The cookie: how it is derived, and why it needs no session store. |
| `lib/admin/authoring.ts` | Draft validation, the exact file format `/guides` reads, and the one-key status rewrite. |
| `lib/admin/markdown-editing.ts` | The toolbar's operations and the undo history, as pure functions. |
| `lib/admin/github.ts` | The contents API client: `PUT /repos/{owner}/{repo}/contents/{path}`. |
| `lib/articles/registry.ts` | The site's read side: both collections as one list, `/guides/<slug>` resolution (the build first, the repository second), the live CMS read, and the collision rule. |
| `components/blog/PostBodyHtml.tsx` | Renders a body read at request time with `lib/admin/preview.ts` — the eval-free path, because a Worker cannot compile MDX. |
| `tests/cmsPipeline.test.ts` | Guards the join: a published file becomes a page and a hub card without a build, a draft does not, and the two body renderers share one class contract. |
| `lib/blog/footers.ts` | The generated foot of an article: FAQs, related checks, related reading. |
| `components/blog/ArticleFooter.tsx` | Renders that foot. |
| `keystatic.config.ts` | The CMS article schema — every field, the categories, the image paths and the editor's capabilities. Still the single source of truth. |
| `public/guides/<slug>.md` | One CMS article per file: YAML front matter, then the Markdown body. |
| `public/uploads/` | Cover images and inline images uploaded through the dashboard. |
| `lib/blog/content.ts` | The build-time reader for the CMS collection. |
| `lib/blog/seo.ts` | Canonical, Open Graph, Twitter and Article/FAQ JSON-LD, as pure functions. |
| `app/guides/` | The public hub and the article page. |
| `tests/blogCms.test.ts` | Guards for the schema, the SEO, the published-only reads and the route moves. |
| `tests/adminDashboard.test.ts` | Guards for the dashboard: auth, alt text, the file format, the publish order, delete, rename, preview, the editor's undo/paste/source features and the status round trip. |
| `tests/adminCollection.test.ts` | Guards for the merge: the guide-module reader, the status rewrite, the index-aware delete, and what both collections list. |
| `tests/articleFooter.test.ts` | Guards for the generated foot: where an answer may come from, and what may be recommended. |
| `tests/editorHistoryPaste.test.ts` | Guards for the undo stack and the HTML ⇄ Markdown round trip. |

## Required environment variables

| Variable | What it is |
| --- | --- |
| `ADMIN_PASSWORD` | The dashboard password. Falls back to the documented default `MySecretPass2026!` when unset — the login page says so while that is true. Set it. |
| `GITHUB_TOKEN` | A token with **Contents: read and write** on `mcfoxfasty/DeviceTry`. Reading the collections and publishing are impossible without it, and `/api/admin/publish` says so by name rather than failing silently. The public site uses the same token to serve an article the build has not seen yet; without it the site still serves every built article, and a publish becomes visible on the next deploy. |
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
`public/guides/*` for the site's pages, and `keystatic.config.ts` is the schema both
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

## The article lifecycle

**`/admin` lists every article**, from both collections — title, slug, source,
publish date, category and status — with a **+ New Article** button and an **Edit**,
**Publish**, **Archive**, **Draft** and **Delete** action per row, subject to what
each format can express. A published row links to its public URL; a draft has none
to link to.

The list is read from the repository **through the GitHub API**, not from the
checked-out files — `lib/admin/collection.ts`. That is not a preference: the site's
build-time reader resolves `public/guides/*` from the process's working directory,
which is right during a build and wrong in the deployed Worker, whose working
directory does not contain the repository. The first deploy of this dashboard proved
it — the article file was in the bundle and the management view still said "No
articles yet" (2026-10-07). Reading through the API also makes the list never a build
behind: an article committed a minute ago is listed, and a deleted one is gone,
without waiting for a deploy. The cost is a couple of requests plus one per file,
which needs `GITHUB_TOKEN` — without it the page says so by name instead of
rendering an empty list. The public site's request-time read is the same reader
(`lib/articles/registry.ts`), so the dashboard and the page a reader opens cannot
disagree about what an article says.

**Edit** (`/admin/edit/<slug>`) loads the saved file — front matter, body and images
— into the Markdown editor. Saving commits an update to **the same path**: the
contents API requires the file's current `sha`, so an edit overwrites rather than
duplicating. If the slug was changed, the old file is removed *after* the new one
lands: a rename, not a copy, so one article never exists at two URLs. If that
removal fails, the save still reports success and says what went wrong. A typed guide
edits at `/admin/source/<slug>` instead — see the two-collections section.

**Status** is one key. Publish, Archive and Draft go through
`/api/admin/status`, which reads the file, rewrites only `status:` (inserting it in
its schema position when the file predates the field) and commits that — so the diff
a reviewer sees is the one line that changed rather than a re-composed article.
Only `published` renders on the site: the guides hub, the article route and the
sitemap all read the published list, so a draft's URL is a 404 and it is never in
the sitemap. The management table shows all three states, which is the point of
having them.

**Delete** asks *Are you sure you want to delete this article?* — naming the file it
will remove — and then calls `DELETE /api/admin/publish?slug=…&source=…`. A CMS
article's file is removed through the GitHub API. Deleting an article that is
already gone is reported as success, because the requested state is what exists.

## The editor

The body is a Markdown textarea with a toolbar, not a `contenteditable` widget. The
toolbar offers **Undo**, **Redo**, H2/H3/H4, bold, italic, strikethrough, inline
code, bulleted and numbered lists, blockquotes, links, tables, fenced code blocks
and dividers, and every button's operation is a pure function with a test. What the
author writes is exactly what is committed — there is no serializer between the two.

**Undo and redo are the editor's own.** The toolbar edits the document
programmatically, and a browser's undo stack only knows about the changes the user
made: after a toolbar action, Ctrl+Z would undo the typing from before it and leave
the action in place. So the editor keeps a stack of states
(`lib/admin/markdown-editing.ts`), the buttons drive it, and **Ctrl+Z** / **Ctrl+Y**
(and Ctrl+Shift+Z) are intercepted to drive the same one. Typing is in the stack too,
coalesced into bursts, so a paragraph is one step rather than one per keystroke. An
undo restores the caret as well as the text.

**A rich paste keeps its formatting.** A paste from a browser, a word processor or a
rendered document carries the same content twice: as HTML, which is what the author
saw, and as plain text, which has lost every table, list and emphasis. The HTML
flavour is converted with `lib/admin/html-to-markdown.ts` — headings (landing inside
the schema's H2–H4 range), emphasis, lists, tables with their alignment, blockquotes,
fenced code, links, captioned images, and the `style` attributes a word processor uses
instead of tags — and inserted as Markdown; a paste with no HTML is left to the
browser.

**The HTML / Source tab** shows the body as HTML and lets the author edit it there.
Leaving the tab converts it back to Markdown with the same converter — the constructs
the toolbar writes round-trip, and a test asserts
`htmlToMarkdown(renderPreview(markdown)) === markdown` — but only when the HTML was
actually edited, so visiting the tab and leaving never rewrites the author's
Markdown. Anything outside the controlled set becomes text rather than being
dropped. Every `<` the converter emits is escaped, because a body is compiled as
MDX, where a raw tag is an element rather than a character.

**Images** are inserted from the panel directly below the body — the toolbar's
**Image** button scrolls to it and focuses its file picker, so it is reachable
without hunting on a phone. A picture there is uploaded with the article: the file
is committed to `public/uploads/` and the Markdown links it from `/uploads/`, with
the required alt text and an optional caption (rendered as the figure caption). The
cover image lives in the SEO sidebar's own upload field.

A **Write / Preview / HTML / Source** tab set sits above the body. Preview renders
the Markdown with `lib/admin/preview.ts` — the constructs the toolbar writes, styled
with the same classes `components/blog/PostBody.tsx` uses — so an article can be
checked before it becomes a commit. It is a preview, not a second renderer to keep
in lockstep with the MDX compiler: everything outside the toolbar's set is shown as
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

## The article's foot, generated

A published CMS article ends with up to three sections, computed from the article and
the site's own registries by `lib/blog/footers.ts` and rendered by
`components/blog/ArticleFooter.tsx`:

1. **Frequently asked questions** — the article's own question-shaped subheadings,
   answered with the paragraphs underneath them, followed by category questions whose
   answers are assembled from the tool registry's own title, description and first
   documented limitation. Nothing is invented: an answer the article does not give and
   the registry does not publish does not appear. A question whose section answers it
   with nothing is dropped rather than published as an empty pair.
2. **Run the related checks** — the diagnostic tools that match this article's tags,
   title and category, scored against each tool's own keywords and category, capped at
   three, and with the reason stated on each card. A tool with no signal behind it is
   not recommended.
3. **Related articles** — the other published articles in one list, whether CMS or
   typed guide, ranked on shared tags, subject words and category, with the reason on
   each card. An article never recommends itself.

The FAQ section is also emitted as a **FAQPage** node in the article's JSON-LD —
from the same list the page renders, so the structured data cannot describe a
question the reader would not find, and an article whose foot is empty emits no
FAQPage at all.

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

A typed guide's source has its own four rules (`lib/admin/source-guard.ts`), run in
the browser for immediate feedback and again in `/api/admin/source` as the guarantee:
the module must keep its `slug` (the published URL), its exported identifier
(`content/guides/index.ts` imports it by name), its top-level `published` flag (the
dashboard's Publish and Archive flip it), and its content.

An image the body references must be either part of the upload or **already in the
repository**: the first case is a new image, the second is an edit pointing at
images an earlier publish committed. The endpoint asks GitHub which one it is, so
a path that is neither is refused before anything is written — and an edit does not
have to re-upload the images its article already has.

## Publishing, and why an article needs a build

Publishing is a **direct commit to GitHub on `main`** through the contents API — no
OAuth, no GitHub App, no per-user token. Images are committed before the article,
because the Markdown links them at their final public paths: if the article landed
first, a build between the two commits would publish an article whose images 404. An
edit reads the file's current `sha` before writing, which is what the contents API
requires to overwrite instead of answering `409`.

That push is also the deployment trigger: Cloudflare builds from the repository's
push event, so a publish, an edit, a delete and a status change all reach the site
through the same path the code does.

Reaching readers takes one of two roads, depending on whether the build has seen the
file. An article the build knows is a prerendered page. A **newer** one is served
from the repository at request time: the article route falls back to
`resolveLiveArticle` (`app/guides/[slug]/page.tsx`) and renders its body with
`PostBodyHtml`, and `/guides` merges the repository's published list into the
build's (`listSiteArticles`). A draft is neither — the live read applies the same
published-only rule, so an unpublished file has no page and no card, exactly as it
has none before a build. A slug in neither the build nor the repository is still a
404, which is the honest answer for a URL that does not exist.

A rename — the same save with a changed slug — commits the new file and then deletes
the old one. `DELETE /api/admin/publish?slug=…` does the second half on its own, and
skips the sha lookup's 404 as "already gone".

Drafts and archived articles are committed like anything else: the file is the
record, and its state decides whether the site renders it. Marking a published
article `draft` therefore unpublishes it on the next build, with no second edit and
no deletion.

## When publishing fails

Every endpoint answers with GitHub's own words: a `401` names the token, a `403`
points at the missing **Contents: write** permission or the rate limit, a `404` at
the repository or branch, and a `409` tells you to publish again so the new version
of the file is read. The dashboard shows that sentence verbatim, because "401 Bad
credentials" is actionable and "publish failed" is not.
