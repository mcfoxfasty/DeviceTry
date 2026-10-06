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
