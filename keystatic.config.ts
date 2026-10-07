import { config, collection, fields } from '@keystatic/core';

/**
 * The DeviceTry CMS schema: the shape of a public/guides article, whose content
 * lives IN this repository.
 *
 * TWO READERS, ONE SCHEMA. `lib/blog/content.ts` parses the collection with
 * `@keystatic/core`'s reader, and `lib/admin/*` composes and commits files
 * against the same field names, categories and image paths. Keeping one file as
 * the source of truth is what stops the dashboard from producing articles the
 * site cannot read.
 *
 * The admin UI at /admin is DeviceTry's own (see docs/cms.md); it replaced
 * Keystatic's OAuth dashboard, which is why only the reader and this schema
 * remain from the package.
 *
 * WHY GITHUB MODE, AND WHAT THAT MEANS FOR THIS SITE.
 * `storage.kind: 'github'` makes publishing a *commit*: the Markdown file and
 * every uploaded image are written to this repository through the GitHub API, so
 * an article's text, its assets, and the code that renders it are reviewed and
 * versioned together. The consequence to know about is that the deployed site is
 * statically prerendered, so a new article appears only after the next build —
 * see `dynamicParams` in app/blog/[slug]/page.tsx, which makes that honest
 * instead of silently rendering a half-configured page.
 *
 * WHY THE POSTS ARE PLAIN MARKDOWN AND NOT MARKDOC.
 * `fields.mdx` writes the body as Markdown with MDX-capable syntax, and it is the
 * field whose editor options this schema configures — headings, lists,
 * blockquotes, code blocks, tables, links and images. The dashboard's own toolbar
 * offers the same set, and POST_EDITOR_OPTIONS below is the promise that the two
 * agree, including that alt text is REQUIRED rather than merely encouraged.
 *
 * THE READS THAT CONSUME THIS FILE.
 * lib/blog/content.ts wraps `createReader` for the site's pages, and
 * lib/blog/seo.ts turns a post into metadata and JSON-LD. Nothing renders MDX
 * through the CMS: the body is compiled at build time by
 * components/blog/PostBody.tsx.
 */

/**
 * Uploaded article images land in `public/uploads` and are served from there.
 *
 * `directory` is the on-disk folder Keystatic commits new files into;
 * `publicPath` is the URL prefix those files are served under. They must describe
 * the same place, or a freshly uploaded image would be committed to one path and
 * requested from another.
 */
export const POST_IMAGE_DIRECTORY = 'public/uploads';
export const POST_IMAGE_PUBLIC_PATH = '/uploads/';

/**
 * The article categories, kept deliberately equal to the site's existing guide
 * taxonomy (content/guides/schema.ts) so a post can be cross-linked with the
 * guides that share its subject instead of living in a parallel vocabulary.
 *
 * `fields.select` requires a default, and that default is the category that most
 * DeviceTry posts are about: a device that is not working.
 */
export const POST_CATEGORIES = [
  { label: 'Audio & Microphones', value: 'audio' },
  { label: 'Cameras & Video', value: 'video' },
  { label: 'Input & Gaming', value: 'input-gaming' },
  { label: 'Display & Screen', value: 'display' },
  { label: 'Network & Internet', value: 'network' },
  { label: 'Buying Guides', value: 'buying' },
  { label: 'How To', value: 'how-to' },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]['value'];

/** Label for a category value, for the article page's own furniture. */
export function postCategoryLabel(value: string): string {
  return POST_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/**
 * The three states an article can be in.
 *
 * `published` is the only state the public site renders: `/blog`, the article
 * routes and the sitemap read through `listPublishedPosts`, so a draft or an
 * archived article is invisible to readers and to search engines without anyone
 * having to remember to hide it. Files written before the field existed have no
 * `status` key at all, and the reader's default — `published` — is what keeps
 * those articles live, which is why the default is the state every article used
 * to have rather than a new one.
 */
export const POST_STATUSES = [
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Archived', value: 'archived' },
] as const;

export type PostStatus = (typeof POST_STATUSES)[number]['value'];

/** The status an article has when its file does not say, or the author did not choose. */
export const DEFAULT_POST_STATUS: PostStatus = 'published';

/** Label for a status value, for the management table's badges. */
export function postStatusLabel(value: string): string {
  return POST_STATUSES.find((s) => s.value === value)?.label ?? value;
}

/**
 * The rich-text editor's exact capability set.
 *
 * Exported so the tests can assert the two things the CMS promises instead of
 * trusting the file: that headings are limited to H2/H3/H4 (the page's H1 is the
 * article title, and a second H1 inside the body would be an accessibility
 * defect) and that every inline image carries BOTH an alt field and a caption
 * field, with alt required.
 *
 * `alt` is a full `fields.text` with validation rather than the default empty
 * string slot, so Keystatic refuses to save an image without alt text — the
 * requirement is enforced at the point the author inserts the image, not
 * discovered later by a screenshot diff.
 *
 * `title` is the image's caption. In Markdown an image's title is an attribute;
 * the renderer promotes it to a visible <figcaption>, which is what a reader
 * expects a caption to be.
 */
export const POST_EDITOR_OPTIONS = {
  bold: true,
  italic: true,
  strikethrough: true,
  code: true,
  heading: [2, 3, 4] as const,
  blockquote: true,
  orderedList: true,
  unorderedList: true,
  table: true,
  link: true,
  codeBlock: true,
  divider: true,
  image: {
    directory: POST_IMAGE_DIRECTORY,
    publicPath: POST_IMAGE_PUBLIC_PATH,
    schema: {
      alt: fields.text({
        label: 'Alt text',
        description:
          'REQUIRED. Describe what the image shows for a reader who cannot see it — not the filename, and not "screenshot".',
        validation: { isRequired: true },
      }),
      title: fields.text({
        label: 'Caption (optional)',
        description: 'Shown under the image. Leave empty for an uncaptioned figure.',
      }),
    },
  },
} as const;

const keystaticConfig = config({
  storage: {
    kind: 'github',
    repo: 'mcfoxfasty/DeviceTry',
  },
  ui: {
    brand: { name: 'DeviceTry' },
    navigation: {
      Content: ['posts'],
    },
  },
  collections: {
    /**
     * One Markdown file per article at public/guides/<slug>.md, with the body
     * below YAML front matter (`format.contentField`) rather than in a second
     * file, so an article is one diff and one review. (The .webp guide artwork
     * beside it is ignored: the reader only lists files ending in the content
     * field's extension.)
     */
    posts: collection({
      label: 'Articles',
      slugField: 'title',
      path: 'public/guides/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'publishedAt'],
      schema: {
        // ---------------------------------------------------- main content
        /**
         * The article's H1 and its URL. `fields.slug` keeps the two in step and
         * lets the author override the slug: editing the title after publishing
         * must never silently break a live URL, which is exactly what a
         * regenerate-on-save slug would do.
         */
        title: fields.slug({
          name: {
            label: 'Article title',
            description: 'Rendered as the page H1 and used as the default slug.',
            validation: { isRequired: true, length: { max: 120 } },
          },
          slug: {
            label: 'URL slug',
            description: 'Lowercase words separated by dashes. Changing this changes the live URL.',
          },
        }),

        content: fields.mdx({
          label: 'Content',
          description:
            'H2/H3/H4 subheadings, bold/italic, lists, blockquotes, code blocks, tables and links. Insert images with the image button — each one asks for alt text and an optional caption.',
          options: POST_EDITOR_OPTIONS as unknown as Parameters<typeof fields.mdx>[0]['options'],
          extension: 'md',
        }),

        // -------------------------------------------------- SEO and social
        /**
         * The <title> a search result shows, when it should differ from the
         * headline. Left empty, the page compacts the headline to fit instead of
         * truncating it mid-word (lib/seo/metadata.ts).
         */
        seoTitle: fields.text({
          label: 'SEO meta title',
          description: 'Optional. Aim for under 60 characters — that is where search results truncate.',
        }),

        /** The SERP snippet. Falls back to the intro paragraph of the body. */
        seoDescription: fields.text({
          label: 'SEO meta description',
          multiline: true,
          description:
            'Optional. 150–160 characters works best. Used verbatim as the meta description and as og:description.',
        }),

        /**
         * The social card and the article's lead image. Required: a published
         * article with no image shares as a bare title, which is the single most
         * common way an otherwise good post gets no clicks.
         */
        coverImage: fields.image({
          label: 'Cover / featured image',
          description: '1200x630 or wider. Used as og:image, twitter:image and the article lead.',
          directory: POST_IMAGE_DIRECTORY,
          publicPath: POST_IMAGE_PUBLIC_PATH,
          validation: { isRequired: true },
        }),

        /**
         * Alt text is a field of its own rather than a property of the upload
         * because a CMS cannot infer meaning from pixels. Required for the same
         * reason: the cover is the one image every reader sees.
         */
        coverImageAlt: fields.text({
          label: 'Cover alternative text',
          description: 'REQUIRED. Describes the cover image in a sentence, for screen readers and image search.',
          validation: { isRequired: true },
        }),

        // ----------------------------------------------------- attribution
        publishedAt: fields.date({
          label: 'Publish date',
          defaultValue: { kind: 'today' },
          validation: { isRequired: true },
        }),

        author: fields.text({
          label: 'Author',
          defaultValue: 'DeviceTry team',
          validation: { isRequired: true },
        }),

        category: fields.select({
          label: 'Category',
          options: POST_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
          defaultValue: 'how-to',
        }),

        /**
         * Publication state. `published` renders on the site; `draft` and
         * `archived` do not — see POST_STATUSES above for why the default is
         * `published` rather than `draft`.
         */
        status: fields.select({
          label: 'Status',
          options: POST_STATUSES.map((s) => ({ label: s.label, value: s.value })),
          defaultValue: DEFAULT_POST_STATUS,
        }),

        /**
         * Free-form tags. They render as chips on the article and as
         * `article:tag` metadata; unlike the single-select category they are not
         * a fixed vocabulary, because a post's useful keywords are its own.
         */
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value || 'New tag',
          validation: { length: { max: 12 } },
        }),

        /**
         * An optional canonical override, for an article that was first published
         * elsewhere. Written as an absolute URL: a relative value here would
         * point at this site and defeat the purpose.
         */
        canonicalUrl: fields.url({
          label: 'Canonical URL override',
          description:
            'Optional, absolute. Set only when this article was first published on another domain.',
        }),
      },
    }),
  },
});

export default keystaticConfig;
