/**
 * Turning a dashboard draft into the exact file /blog reads.
 *
 * THE FORMAT IS NOT INVENTED HERE. An article is a Markdown file with YAML front
 * matter whose keys are the fields of keystatic.config.ts, and the reader in
 * lib/blog/content.ts parses it against that schema. `composePostFile` therefore
 * reproduces the layout of the articles already in content/posts — scalars plain
 * when YAML allows it and single-quoted when not, `tags` as a block sequence,
 * `canonicalUrl: null` when there is no override, and the body BELOW the front
 * matter (which is where `format: { contentField: 'content' }` writes it in this
 * version of the CMS).
 *
 * That format is verified empirically, not by inspection: a test composes a file,
 * writes it into content/posts, reads it back through the same reader the pages
 * use, and asserts every field survives the round trip. A composer that produced
 * plausible-looking YAML the reader mis-parses would fail that test.
 *
 * WHY VALIDATION IS SERVER-SIDE AND NOT JUST IN THE FORM.
 * The form checks the same rules for instant feedback, but the endpoint is the
 * only thing that cannot be bypassed — and two of these rules protect published
 * articles rather than the author's convenience: an image without alt text is an
 * accessibility defect on a public page, and a cover image without alt text is
 * the one image every reader sees. Those are enforced here on the server, on the
 * cover AND on every inline image reference in the body.
 */

import {
  DEFAULT_POST_STATUS,
  POST_CATEGORIES,
  POST_IMAGE_DIRECTORY,
  POST_IMAGE_PUBLIC_PATH,
  POST_STATUSES,
  type PostStatus,
} from '@/keystatic.config';
import { imageReferences } from '@/lib/admin/markdown-editing';

/** Everything an article carries. Empty strings mean "not filled in". */
export interface PostDraft {
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  coverImage: string;
  coverImageAlt: string;
  publishedAt: string;
  author: string;
  category: string;
  /** Publication state: only `published` renders on the public site. */
  status: PostStatus;
  tags: string[];
  canonicalUrl: string;
  content: string;
}

/** A slug an existing article was saved under, when an edit renamed it. */
export interface PublishPayload {
  draft: PostDraft;
  images: UploadedImage[];
  /**
   * The slug the article was read from, when this is an edit whose slug changed.
   * Publishing then commits the new file AND removes the old one — a rename, not
   * a copy — because two files with one article's content is a duplicate URL the
   * moment both are built.
   */
  previousSlug?: string;
}

/** An image the dashboard uploaded along with the article. */
export interface UploadedImage {
  /** Final filename, e.g. `keyboard-cover-8f31c2ab.png`. */
  filename: string;
  contentType: string;
  /** Base64 of the bytes, without the `data:` prefix. */
  base64: string;
}

/** Where a post is committed. Mirrors the collection path in keystatic.config.ts. */
export function postRepoPath(slug: string): string {
  return `content/posts/${slug}.md`;
}

/** The public URL an uploaded image is served from. */
export function publicImagePath(filename: string): string {
  return `${POST_IMAGE_PUBLIC_PATH}${filename}`;
}

/** Where an uploaded image is committed. */
export function imageRepoPath(filename: string): string {
  return `${POST_IMAGE_DIRECTORY}/${filename}`;
}

/** The image types the editor accepts, and the extensions they map to. */
export const ALLOWED_IMAGE_TYPES: Record<string, string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/avif': ['avif'],
};

/** 5 MB per image, 20 MB for a whole article: a phone photo is well inside this. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGES = 20;

/** A filename the repository will accept as a single path segment. */
const SAFE_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpe?g|webp|gif|avif)$/;

/** The shortest alt text this dashboard will accept, in characters. */
export const MIN_ALT_TEXT_LENGTH = 8;

/**
 * Validate alt text.
 *
 * "Required" is not enough on its own: `a.png`, `screenshot` and `...` all satisfy
 * a non-empty check and none of them describe the image to a screen reader, which
 * is the entire purpose. So the rule is a floor on length AND at least one letter,
 * and the message says what to write instead of complaining that a field is empty.
 *
 * The order of the checks is the order of usefulness to the author: empty first,
 * then "this is not words at all" (which `...` fails, and which a length message
 * would describe misleadingly), then the length floor.
 */
export function validateAltText(value: string, what = 'alt text'): string | null {
  const text = value.trim();
  if (text.length === 0) return `${what} is required — describe what the image shows.`;
  if (!/[a-zA-Z]/.test(text)) return `${what} must contain words, not only punctuation.`;
  if (text.length < MIN_ALT_TEXT_LENGTH) {
    return `${what} is too short to describe the image (at least ${MIN_ALT_TEXT_LENGTH} characters).`;
  }
  return null;
}

/** `My Article Title!` → `my-article-title`. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** `Cover Photo.PNG` → `cover-photo`, keeping the extension decision to the type. */
export function imageBaseName(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^.]+$/, '');
  return slugify(withoutExtension) || 'image';
}

/** A short, stable digest of bytes, used to keep uploaded filenames unique. */
export async function contentDigest(base64: string): Promise<string> {
  const bytes = new TextEncoder().encode(base64.slice(0, 4096) + ':' + base64.length);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8);
}

/** Whether a base64 string is one, strictly. */
export function isBase64(value: string): boolean {
  return value.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0;
}

/** The size in bytes a base64 string decodes to, without decoding it. */
export function base64ByteLength(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

/** Validate one uploaded image. Returns a message, or `null` when it is usable. */
export function validateImage(image: UploadedImage): string | null {
  if (!SAFE_FILENAME.test(image.filename)) {
    return `"${image.filename}" is not a usable image filename (lowercase words separated by dashes, ending in .png, .jpg, .jpeg, .webp, .gif or .avif).`;
  }
  const extension = image.filename.split('.').pop() ?? '';
  const allowed = ALLOWED_IMAGE_TYPES[image.contentType];
  if (!allowed || !allowed.includes(extension)) {
    return `"${image.filename}" is declared as ${image.contentType || 'an unknown type'}, which does not match its extension.`;
  }
  if (!isBase64(image.base64)) return `"${image.filename}" did not arrive as base64 data.`;
  if (base64ByteLength(image.base64) > MAX_IMAGE_BYTES) {
    return `"${image.filename}" is larger than ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`;
  }
  return null;
}

/**
 * Every rule the publish endpoint enforces, as field → message.
 *
 * The category must be one of POST_CATEGORIES: an unknown value would render an
 * article with a raw slug as its label and break the cross-linking the taxonomy
 * exists for.
 */
export function validateDraft(draft: PostDraft): Record<string, string> {
  const errors: Record<string, string> = {};

  const title = draft.title.trim();
  if (title.length === 0) errors.title = 'An article title is required.';
  else if (title.length > 120) errors.title = 'Titles are limited to 120 characters (the schema enforces this).';

  const slug = draft.slug.trim();
  if (slug.length === 0) errors.slug = 'A URL slug is required.';
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = 'The slug must be lowercase words separated by single dashes.';
  }

  if (draft.content.trim().length === 0) errors.content = 'The article body is empty.';

  if (draft.coverImage.trim().length === 0) {
    errors.coverImage = 'A cover image is required: it is the article lead and its social card.';
  }
  const coverAlt = validateAltText(draft.coverImageAlt, 'Cover alt text');
  if (coverAlt) errors.coverImageAlt = coverAlt;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.publishedAt.trim())) {
    errors.publishedAt = 'A publish date is required, as YYYY-MM-DD.';
  }
  if (draft.author.trim().length === 0) errors.author = 'An author is required.';

  if (!POST_CATEGORIES.some((category) => category.value === draft.category)) {
    errors.category = 'Choose one of the site categories.';
  }

  if (!POST_STATUSES.some((status) => status.value === draft.status)) {
    errors.status = 'Choose a status: published, draft or archived.';
  }

  if (draft.tags.length > 12) errors.tags = 'At most 12 tags (the schema enforces this).';

  const canonical = draft.canonicalUrl.trim();
  if (canonical.length > 0 && !/^https?:\/\/[^\s]+$/.test(canonical)) {
    errors.canonicalUrl = 'The canonical override must be an absolute http(s) URL.';
  }

  // Inline images: every one must carry real alt text, and any image that this
  // article is expected to publish has to be part of the upload.
  for (const reference of imageReferences(draft.content)) {
    const problem = validateAltText(reference.alt, `Alt text for ${reference.url}`);
    if (problem) {
      errors.content = `${problem} Fix the image reference before publishing.`;
      break;
    }
  }

  return errors;
}

/**
 * The images the body references, split into the ones this upload provides and
 * anything else (an external URL, or an image committed by an earlier article).
 */
export function referencedUploads(
  content: string,
  uploads: UploadedImage[]
): { provided: UploadedImage[]; missing: string[] } {
  const available = new Map(uploads.map((image) => [publicImagePath(image.filename), image]));
  const provided: UploadedImage[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const reference of imageReferences(content)) {
    if (!reference.url.startsWith(POST_IMAGE_PUBLIC_PATH)) continue;
    if (seen.has(reference.url)) continue;
    seen.add(reference.url);
    const upload = available.get(reference.url);
    if (upload) provided.push(upload);
    else missing.push(reference.url);
  }

  return { provided, missing };
}

/**
 * Quote a YAML scalar the way js-yaml does: plain when it is safe, else single-quoted.
 *
 * A quote inside a plain scalar is legal YAML — `author: The author's own words`
 * parses — so a value containing one is quoted for a different reason: every
 * article already in the repository has such values single-quoted (they were
 * written by the CMS's own YAML writer), and a composer that quietly changed
 * quoting style would make the next diff of every edited article larger than the
 * edit that caused it.
 */
export function yamlScalar(value: string): string {
  const plainIsSafe =
    value.length > 0 &&
    value === value.trim() &&
    !/[\n\r\t]/.test(value) &&
    !/['"]/.test(value) &&
    !/[:#]\s/.test(value) &&
    !/^[\-?:,[\]{}#&*!|>'"%@`]/.test(value) &&
    !/^(?:true|false|null|yes|no|on|off|~)$/i.test(value) &&
    !/^[-+]?\d+(?:\.\d+)?$/.test(value) &&
    !/[:#]$/.test(value);

  if (plainIsSafe) return value;
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Compose the file that /blog reads.
 *
 * Field order matches the articles already in the repository, so a diff on a CMS
 * edit shows changed values rather than a reordered file.
 */
export function composePostFile(draft: PostDraft): string {
  const tags = draft.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  const canonical = draft.canonicalUrl.trim();

  const lines = [
    '---',
    `title: ${yamlScalar(draft.title.trim())}`,
    draft.seoTitle.trim().length > 0 ? `seoTitle: ${yamlScalar(draft.seoTitle.trim())}` : 'seoTitle: null',
    draft.seoDescription.trim().length > 0
      ? `seoDescription: ${yamlScalar(draft.seoDescription.trim())}`
      : 'seoDescription: null',
    `coverImage: ${draft.coverImage.trim()}`,
    `coverImageAlt: ${yamlScalar(draft.coverImageAlt.trim())}`,
    `publishedAt: ${draft.publishedAt.trim()}`,
    `author: ${yamlScalar(draft.author.trim())}`,
    `category: ${draft.category}`,
    `status: ${draft.status}`,
    tags.length > 0 ? 'tags:' : 'tags: []',
    ...tags.map((tag) => `  - ${yamlScalar(tag)}`),
    `canonicalUrl: ${canonical.length > 0 ? yamlScalar(canonical) : 'null'}`,
    '---',
    '',
    draft.content.trim(),
    '',
  ];

  return lines.join('\n');
}
