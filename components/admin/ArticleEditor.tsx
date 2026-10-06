'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALLOWED_IMAGE_TYPES,
  imageBaseName,
  contentDigest,
  slugify,
  validateAltText,
  validateDraft,
  type UploadedImage,
} from '@/lib/admin/authoring';
import {
  codeBlockTemplate,
  imageMarkdown,
  insertBlock,
  insertImage,
  insertText,
  prefixLines,
  tableTemplate,
  toggleWrap,
  type EditResult,
  type EditState,
} from '@/lib/admin/markdown-editing';

/**
 * The article editor: one Markdown body, one SEO panel, one publish button.
 *
 * WHY A TEXTAREA AND NOT A WYSIWYG WIDGET.
 * The previous dashboard failed on phones, so reliability on iOS Safari is a
 * requirement rather than a nicety. A textarea plus toolbar buttons behaves the
 * same in every browser, cannot be broken by a contenteditable quirk, and keeps
 * the Markdown the author writes identical to the Markdown that gets committed.
 * The toolbar's operations are pure functions in lib/admin/markdown-editing.ts, so
 * what each button produces is asserted by tests instead of eyeballed.
 *
 * WHAT THE EDITOR ENFORCES, AND WHY IT IS ALSO ENFORCED ON THE SERVER.
 * An image cannot be inserted without alt text, and the cover image cannot be
 * chosen without it either — the two rules that protect a published page's
 * accessibility. The same checks run again in /api/admin/publish, because a form
 * is a convenience and the endpoint is the guarantee.
 *
 * DRAFTS SURVIVE A CLOSED TAB. Mobile browsers discard background tabs, and an
 * author who loses 800 words to that will not come back. The text fields are saved
 * to localStorage on every change and restored on load; uploaded images are
 * deliberately not, because several megabytes of base64 in localStorage is the one
 * thing that would break the store for everything else on this origin.
 */

const DRAFT_KEY = 'devicetry-admin-draft-v1';

/**
 * The toolbar's heading buttons.
 *
 * The page title is the H1, so the body starts at H2 — and the labels are written
 * out rather than derived from a level, because "H2" is what the author clicks.
 */
const HEADING_BUTTONS = [
  { level: 2, label: 'H2' },
  { level: 3, label: 'H3' },
  { level: 4, label: 'H4' },
] as const;

interface Category {
  value: string;
  label: string;
}

interface DraftState {
  title: string;
  slug: string;
  slugEdited: boolean;
  seoTitle: string;
  seoDescription: string;
  coverImage: string;
  coverImageAlt: string;
  publishedAt: string;
  author: string;
  category: string;
  tagText: string;
  canonicalUrl: string;
  content: string;
}

/** A published article, or a failure worth showing the author verbatim. */
type Status =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'ok'; message: string; url: string }
  | { kind: 'error'; message: string; errors?: Record<string, string> };

const inputClass =
  'w-full rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#192332] px-3 py-2 text-sm outline-none focus:border-[#0F766E] dark:focus:border-[#14B8A6] focus:ring-2 focus:ring-[#E6F4F2] dark:focus:ring-[#132E2E]';

const buttonClass =
  'rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#192332] px-2.5 py-1.5 text-xs font-medium hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition';

/** Read a File as base64, without its `data:` prefix. */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma === -1 ? '' : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

/** A labelled field with an optional hint and error line. */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error ? <span className="text-xs text-[#8996A6]">{hint}</span> : null}
      {error ? (
        <span role="alert" className="text-xs text-[#DC2626] dark:text-[#EF4444]">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ArticleEditor({ categories, today }: { categories: Category[]; today: string }) {
  const initialDraft: DraftState = useMemo(
    () => ({
      title: '',
      slug: '',
      slugEdited: false,
      seoTitle: '',
      seoDescription: '',
      coverImage: '',
      coverImageAlt: '',
      publishedAt: today,
      author: 'DeviceTry team',
      category: categories[0]?.value ?? 'how-to',
      tagText: '',
      canonicalUrl: '',
      content: '',
    }),
    [categories, today]
  );

  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [restored, setRestored] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [imagePanel, setImagePanel] = useState<{ alt: string; caption: string; file: File | null; error: string }>({
    alt: '',
    caption: '',
    file: null,
    error: '',
  });
  const [coverBusy, setCoverBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const restoredOnce = useRef(false);

  // ---- drafts ------------------------------------------------------------
  useEffect(() => {
    if (restoredOnce.current) return;
    restoredOnce.current = true;
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<DraftState>;
      /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration read of the saved draft; a lazy useState initializer would read localStorage during render and mismatch the server markup. */
      setDraft((current) => ({ ...current, ...parsed, slugEdited: parsed.slugEdited ?? false }));
      setRestored(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // A corrupt draft is not worth an error message; the editor simply starts empty.
    }
  }, []);

  useEffect(() => {
    if (!restoredOnce.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage can be full or disabled; the editor must still work.
    }
  }, [draft]);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setDraft(initialDraft);
    setImages([]);
    setRestored(false);
    setStatus({ kind: 'idle' });
  }, [initialDraft]);

  // ---- markdown editing ---------------------------------------------------
  const apply = useCallback((operation: (state: EditState) => EditResult) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next = operation({
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    });
    setDraft((current) => ({ ...current, content: next.value }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }, []);

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const onTitleChange = (value: string) =>
    setDraft((current) => ({
      ...current,
      title: value,
      // The slug follows the title until the author edits it by hand — after
      // that, changing the title must never silently move a published URL.
      slug: current.slugEdited ? current.slug : slugify(value),
    }));

  // ---- images ------------------------------------------------------------
  const prepareUpload = useCallback(
    async (file: File): Promise<{ image?: UploadedImage; error?: string }> => {
      const contentType = file.type || '';
      const extensions = ALLOWED_IMAGE_TYPES[contentType];
      if (!extensions) {
        return { error: 'That file is not a supported image (PNG, JPEG, WebP, GIF or AVIF).' };
      }
      const base64 = await readBase64(file);
      const supplied = file.name.toLowerCase().split('.').pop() ?? '';
      const extension = extensions.includes(supplied) ? supplied : extensions[0];
      const filename = `${imageBaseName(file.name)}-${await contentDigest(base64)}.${extension}`;
      return { image: { filename, contentType, base64 } };
    },
    []
  );

  const insertInlineImage = useCallback(async () => {
    const altProblem = validateAltText(imagePanel.alt, 'Alt text');
    if (!imagePanel.file) {
      setImagePanel((panel) => ({ ...panel, error: 'Choose an image first.' }));
      return;
    }
    if (altProblem) {
      // The rule the brief calls out: an image cannot reach the article without it.
      setImagePanel((panel) => ({ ...panel, error: altProblem }));
      return;
    }

    const { image, error } = await prepareUpload(imagePanel.file);
    if (!image) {
      setImagePanel((panel) => ({ ...panel, error: error ?? 'That image could not be read.' }));
      return;
    }

    setImages((current) => [...current.filter((entry) => entry.filename !== image.filename), image]);
    const url = `/images/posts/${image.filename}`;
    apply((state) => insertImage(state, url, imagePanel.alt.trim(), imagePanel.caption));
    setImagePanel({ alt: '', caption: '', file: null, error: '' });
  }, [apply, imagePanel, prepareUpload]);

  const chooseCover = useCallback(
    async (file: File) => {
      setCoverBusy(true);
      const { image, error } = await prepareUpload(file);
      if (!image) {
        setStatus({ kind: 'error', message: error ?? 'That cover image could not be read.' });
        setCoverBusy(false);
        return;
      }
      setImages((current) => [...current.filter((entry) => entry.filename !== image.filename), image]);
      set('coverImage', `/images/posts/${image.filename}`);
      setCoverBusy(false);
    },
    [prepareUpload]
  );

  // ---- validation and publishing -----------------------------------------
  const fullDraft = useMemo(
    () => ({
      ...draft,
      tags: draft.tagText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    }),
    [draft]
  );

  const errors = useMemo(() => validateDraft(fullDraft), [fullDraft]);
  const shown = (field: string) => (attempted ? errors[field] : undefined);
  const ready = Object.keys(errors).length === 0;

  /**
   * The cover's alt text, judged as soon as a cover has been chosen.
   *
   * The same rule is in `validateDraft` and in the publish endpoint, but this one
   * speaks up before the author has written the article rather than after a
   * failed publish, which is when the fix is cheap: the cover is picked first, the
   * sentence describing it can be written then.
   */
  const coverAltProblem = useMemo(
    () => (draft.coverImage.trim().length > 0 ? validateAltText(draft.coverImageAlt, 'Cover alt text') : null),
    [draft.coverImage, draft.coverImageAlt]
  );

  const publish = useCallback(async () => {
    setAttempted(true);
    if (!ready) {
      setStatus({ kind: 'error', message: 'Fix the highlighted fields before publishing.' });
      return;
    }

    setStatus({ kind: 'publishing' });
    try {
      const response = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft: fullDraft, images }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; url?: string; errors?: Record<string, string> }
        | null;

      if (!response.ok || !body?.ok) {
        setStatus({
          kind: 'error',
          message: body?.message ?? `Publishing failed (HTTP ${response.status}).`,
          errors: body?.errors,
        });
        return;
      }

      setStatus({
        kind: 'ok',
        message: 'Committed to the repository.',
        url: body.url ?? `/blog/${fullDraft.slug}`,
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
    } catch (error) {
      setStatus({
        kind: 'error',
        message: `The request did not complete: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }, [fullDraft, images, ready]);

  return (
    <div className="flex flex-col gap-5">
      {restored ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E0F2FE] dark:border-[#082F49] bg-[#E0F2FE] dark:bg-[#082F49] px-3 py-2 text-sm text-[#0284C7] dark:text-[#38BDF8]">
          <span>Restored the draft saved in this browser.</span>
          <button type="button" onClick={discardDraft} className="underline">
            Start fresh
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------------------------------------------------- editor */}
        <section className="flex flex-col gap-4 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 sm:p-5">
          <Field
            label="Article title"
            hint="Rendered as the page H1 and used for the slug until you edit it."
            error={shown('title') ?? statusErrors(status, 'title')}
          >
            <input
              className={inputClass}
              value={draft.title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Keyboard keys not registering? Hardware or software"
            />
          </Field>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <Field label="URL slug" error={shown('slug')}>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-[#8996A6]">/blog/</span>
                  <input
                    className={inputClass}
                    value={draft.slug}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, slug: event.target.value, slugEdited: true }))
                    }
                  />
                </div>
              </Field>
            </div>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setDraft((current) => ({ ...current, slug: slugify(current.title), slugEdited: false }))}
            >
              Use title
            </button>
          </div>

          {/* toolbar */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {HEADING_BUTTONS.map(({ level, label }) => (
                <button
                  key={label}
                  type="button"
                  className={buttonClass}
                  onClick={() => apply((state) => prefixLines(state, `${'#'.repeat(level)} `))}
                >
                  {label}
                </button>
              ))}
              <button type="button" className={buttonClass} onClick={() => apply((state) => toggleWrap(state, '**'))}>
                Bold
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => toggleWrap(state, '_'))}>
                Italic
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => toggleWrap(state, '~~'))}>
                Strike
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => toggleWrap(state, '`'))}>
                Code
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => prefixLines(state, '- '))}>
                Bullets
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => prefixLines(state, '1. '))}>
                Numbered
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => prefixLines(state, '> '))}>
                Quote
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => apply((state) => insertText(state, '[link text](https://example.com)'))}
              >
                Link
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => insertBlock(state, tableTemplate()))}>
                Table
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => apply((state) => insertBlock(state, codeBlockTemplate()))}
              >
                Code block
              </button>
              <button type="button" className={buttonClass} onClick={() => apply((state) => insertBlock(state, '---'))}>
                Divider
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={draft.content}
              onChange={(event) => set('content', event.target.value)}
              rows={18}
              spellCheck
              placeholder={'Write the article.\n\n## A subheading\n\n- a list item\n\n| Column | Column |\n| --- | --- |\n|  |  |'}
              className={`${inputClass} font-mono text-[13px] leading-relaxed min-h-[320px] resize-y`}
            />
            {shown('content') || statusErrors(status, 'content') ? (
              <span role="alert" className="text-xs text-[#DC2626] dark:text-[#EF4444]">
                {shown('content') ?? statusErrors(status, 'content')}
              </span>
            ) : null}
          </div>

          {/* inline image */}
          <div className="rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F7F6FB] dark:bg-[#192332] p-3">
            <p className="text-sm font-medium">Insert an image</p>
            <p className="mt-0.5 text-xs text-[#8996A6]">
              Alt text is required — it is what a screen reader announces instead of the picture.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <input
                type="file"
                accept={Object.keys(ALLOWED_IMAGE_TYPES).join(',')}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setImagePanel((panel) => ({ ...panel, file, error: '' }));
                }}
                className="text-xs"
              />
              <input
                className={inputClass}
                value={imagePanel.alt}
                onChange={(event) => setImagePanel((panel) => ({ ...panel, alt: event.target.value, error: '' }))}
                placeholder="Alt text (required, e.g. A worn keyboard switch with a bright contact)"
              />
              <input
                className={inputClass}
                value={imagePanel.caption}
                onChange={(event) => setImagePanel((panel) => ({ ...panel, caption: event.target.value, error: '' }))}
                placeholder="Caption (optional, shown under the image)"
              />
              <button
                type="button"
                onClick={insertInlineImage}
                className="self-start rounded-lg bg-[#0F766E] dark:bg-[#14B8A6] px-3 py-2 text-sm font-medium text-white dark:text-[#0B111A] hover:bg-[#0D665F] dark:hover:bg-[#2DD4BF] transition"
              >
                Insert image
              </button>
              {imagePanel.error ? (
                <span role="alert" className="text-xs text-[#DC2626] dark:text-[#EF4444]">
                  {imagePanel.error}
                </span>
              ) : null}
            </div>
          </div>

          {images.length > 0 ? (
            <p className="text-xs text-[#8996A6]">
              {images.length} image{images.length === 1 ? '' : 's'} ready to commit:{' '}
              {images.map((image) => image.filename).join(', ')}
            </p>
          ) : null}
        </section>

        {/* ------------------------------------------------------- SEO panel */}
        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5F6B7A] dark:text-[#9AA6B8]">
              SEO &amp; social
            </h2>

            <Field
              label="SEO meta title"
              hint="Optional, under 60 characters. Falls back to a compacted title."
              error={shown('seoTitle')}
            >
              <input
                className={inputClass}
                value={draft.seoTitle}
                onChange={(event) => set('seoTitle', event.target.value)}
              />
            </Field>

            <Field label="SEO meta description" hint="Optional, 150–160 characters." error={shown('seoDescription')}>
              <textarea
                className={`${inputClass} min-h-[84px]`}
                value={draft.seoDescription}
                onChange={(event) => set('seoDescription', event.target.value)}
              />
            </Field>

            <Field label="Canonical URL override" hint="Optional, absolute. Only for an article first published elsewhere." error={shown('canonicalUrl')}>
              <input
                className={inputClass}
                value={draft.canonicalUrl}
                onChange={(event) => set('canonicalUrl', event.target.value)}
                placeholder="https://example.com/original"
              />
            </Field>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5F6B7A] dark:text-[#9AA6B8]">
              Cover image
            </h2>

            <Field label="Cover image" hint="1200×630 or wider. Used as og:image and the article lead." error={shown('coverImage')}>
              <input
                type="file"
                accept={Object.keys(ALLOWED_IMAGE_TYPES).join(',')}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void chooseCover(file);
                }}
                className="text-xs"
              />
            </Field>
            {coverBusy ? <span className="text-xs text-[#8996A6]">Reading the image…</span> : null}
            {draft.coverImage ? (
              <span className="break-all font-mono text-[11px] text-[#8996A6]">{draft.coverImage}</span>
            ) : null}

            <Field label="Cover alt text" hint="Required. Describes the cover for screen readers." error={shown('coverImageAlt') ?? coverAltProblem ?? undefined}>
              <textarea
                className={`${inputClass} min-h-[72px]`}
                value={draft.coverImageAlt}
                onChange={(event) => set('coverImageAlt', event.target.value)}
                placeholder="The DeviceTry cover card showing the wordmark"
              />
            </Field>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5F6B7A] dark:text-[#9AA6B8]">
              Details
            </h2>

            <Field label="Publish date" error={shown('publishedAt')}>
              <input
                type="date"
                className={inputClass}
                value={draft.publishedAt}
                onChange={(event) => set('publishedAt', event.target.value)}
              />
            </Field>

            <Field label="Author" error={shown('author')}>
              <input className={inputClass} value={draft.author} onChange={(event) => set('author', event.target.value)} />
            </Field>

            <Field label="Category" error={shown('category')}>
              <select
                className={inputClass}
                value={draft.category}
                onChange={(event) => set('category', event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tags" hint="Comma separated, up to 12." error={shown('tags')}>
              <input
                className={inputClass}
                value={draft.tagText}
                onChange={(event) => set('tagText', event.target.value)}
                placeholder="keyboard, troubleshooting"
              />
            </Field>
          </section>

          <section className="sticky bottom-3 flex flex-col gap-3 rounded-2xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 shadow-sm">
            <button
              type="button"
              onClick={publish}
              disabled={status.kind === 'publishing'}
              className="w-full rounded-lg bg-[#0F766E] dark:bg-[#14B8A6] px-4 py-3 text-base font-medium text-white dark:text-[#0B111A] hover:bg-[#0D665F] dark:hover:bg-[#2DD4BF] disabled:opacity-60 transition"
            >
              {status.kind === 'publishing' ? 'Publishing…' : 'Publish to GitHub'}
            </button>
            <p className="text-xs text-[#8996A6]">
              Commits <span className="font-mono">content/posts/{draft.slug || 'slug'}.md</span> and the images to{' '}
              <span className="font-mono">main</span>. The article appears on the site after the next build.
            </p>

            {status.kind === 'ok' ? (
              <p className="rounded-lg border border-[#DCFCE7] dark:border-[#052E16] bg-[#DCFCE7] dark:bg-[#052E16] px-3 py-2 text-xs text-[#16A34A] dark:text-[#22C55E]">
                {status.message} <a className="underline" href={status.url}>{status.url}</a>
              </p>
            ) : null}
            {status.kind === 'error' ? (
              <p
                role="alert"
                className="rounded-lg border border-[#FEE2E2] dark:border-[#450A0A] bg-[#FEE2E2] dark:bg-[#450A0A] px-3 py-2 text-xs text-[#DC2626] dark:text-[#EF4444]"
              >
                {status.message}
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

/** A field error the server returned, shown next to the field it belongs to. */
function statusErrors(status: Status, field: string): string | undefined {
  return status.kind === 'error' ? status.errors?.[field] : undefined;
}

/** Exported for the tests that assert the image Markdown the editor produces. */
export { imageMarkdown };
