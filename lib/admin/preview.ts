/**
 * The editor's Preview tab: the Markdown body as HTML, before it is committed.
 *
 * WHY A LOCAL RENDERER AND NOT THE BLOG'S OWN PIPELINE. The blog compiles its
 * bodies with MDX during `next build` — components/blog/PostBody.tsx — and that
 * compiler cannot run in the editor's browser tab. Rather than pull a second
 * Markdown library into the client bundle, this renders the same constructs the
 * editor's toolbar produces (headings, emphasis, lists, tables, fenced code,
 * blockquotes, images with captions, links, dividers) with the same classes
 * PostBody uses, so the preview shows the article's shape and look.
 *
 * WHAT IT IS NOT: a full CommonMark implementation. The toolbar is the contract
 * for what goes into a body (POST_EDITOR_OPTIONS in keystatic.config.ts is the
 * schema-side copy of it), and constructs outside that set — nested lists, raw
 * HTML, reference links — are rendered as plain text rather than half-parsed.
 * The preview is a check on the article, not a second renderer to keep in
 * lockstep with the compiler.
 *
 * ESCAPING IS THE SECURITY MODEL. Every text run is HTML-escaped before any
 * markup is generated, and only this file's own tags are ever emitted, so a body
 * containing `<script>` previews as visible text — the same choice a blog whose
 * compiler would treat it as MDX should not rely on. Attributes built from
 * article content (href, src, alt, title) are quoted and escaped here.
 */

/** The classes PostBody puts on each element, so the preview looks like the article. */
const CLASSES = {
  h2: 'mt-10 mb-3 text-2xl font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]',
  h3: 'mt-8 mb-2 text-xl font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]',
  h4: 'mt-6 mb-2 text-base font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]',
  p: 'my-4 text-sm leading-relaxed text-[#3E4C5E] dark:text-[#B8C2D0]',
  a: 'font-semibold text-[#0F766E] dark:text-[#14B8A6] underline underline-offset-2',
  ul: 'my-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[#3E4C5E] dark:text-[#B8C2D0]',
  ol: 'my-4 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[#3E4C5E] dark:text-[#B8C2D0]',
  blockquote:
    'my-6 border-l-4 border-[#0F766E]/40 bg-[#F1F4F7] dark:bg-[#192332] px-4 py-3 rounded-r-lg text-sm italic text-[#3E4C5E] dark:text-[#B8C2D0]',
  pre: 'my-5 overflow-x-auto rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#131B27] p-4 text-[12px] leading-relaxed',
  code: 'rounded bg-[#F1F4F7] dark:bg-[#192332] px-1.5 py-0.5 font-mono text-[12px] text-[#142033] dark:text-[#E9EEF4]',
  table: 'w-full border-collapse text-sm',
  th: 'border border-[#DFE5EB] dark:border-[#223043] bg-[#F1F4F7] dark:bg-[#192332] px-3 py-2 text-left font-semibold text-[#142033] dark:text-[#E9EEF4]',
  td: 'border border-[#DFE5EB] dark:border-[#223043] px-3 py-2 align-top text-[#3E4C5E] dark:text-[#B8C2D0]',
  figure: 'my-6',
  img: 'w-full rounded-xl border border-[#DFE5EB] dark:border-[#223043]',
  figcaption: 'mt-2 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]',
  hr: 'my-8 border-t border-[#DFE5EB] dark:border-[#223043]',
} as const;

/** Escape a text run for use as HTML text or inside a quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** An external href opens in a new tab, the way the blog's own links do. */
function anchor(href: string, inner: string): string {
  const escaped = escapeHtml(href);
  const external = !escaped.startsWith('/') && !escaped.startsWith('#');
  return `<a href="${escaped}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''} class="${CLASSES.a}">${inner}</a>`;
}

/** `![alt](src 'caption')` → the figure PostBody renders. */
function figure(url: string, alt: string, caption: string): string {
  const captionHtml = caption.trim().length > 0 ? `<figcaption class="${CLASSES.figcaption}">${escapeHtml(caption.trim())}</figcaption>` : '';
  return `<figure class="${CLASSES.figure}"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" class="${CLASSES.img}" />${captionHtml}</figure>`;
}

const INLINE_CODE = /`([^`\n]+)`/;
const IMAGE = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+['"]([^'"]*)['"])?\s*\)/;
const LINK = /\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+['"]([^'"]*)['"])?\s*\)/;
const BOLD = /\*\*([^*]+)\*\*/;
const STRIKE = /~~([^~]+)~~/;
const ITALIC = /(^|[^*\w])_([^_]+)_(?![\w_])/;

/**
 * One line's inline content: code spans, images, links, bold, strike, italic.
 *
 * The three structured constructs — code, images, links — are lifted out with
 * placeholders BEFORE any escaping, then rebuilt from their raw parts. Escaping
 * first would not work: it turns the `'` around an image caption into `&#39;`,
 * and the image is no longer an image but a sentence with punctuation in it.
 * Everything left after the lift is escaped as text, and every attribute is
 * rebuilt through escapeHtml, so an article can decorate itself but never
 * inject markup.
 */
export function renderInline(line: string): string {
  type Token =
    | { kind: 'code'; text: string }
    | { kind: 'image'; url: string; alt: string; caption: string }
    | { kind: 'link'; href: string; label: string };
  const tokens: Token[] = [];
  const lift = (token: Token): string => `\u0000${tokens.push(token) - 1}\u0000`;

  let text = line.replace(INLINE_CODE, (_match, code: string) => lift({ kind: 'code', text: code }));
  text = text.replace(IMAGE, (_m, alt: string, url: string, caption?: string) =>
    lift({ kind: 'image', url, alt, caption: caption ?? '' })
  );
  text = text.replace(LINK, (_m, label: string, href: string) => lift({ kind: 'link', href, label }));

  text = escapeHtml(text)
    .replace(BOLD, '<strong>$1</strong>')
    .replace(STRIKE, '<del>$1</del>')
    .replace(ITALIC, '$1<em>$2</em>');

  return text.replace(/\u0000(\d+)\u0000/g, (_m, index: string) => {
    const token = tokens[Number(index)];
    if (!token) return '';
    if (token.kind === 'code') return `<code class="${CLASSES.code}">${escapeHtml(token.text)}</code>`;
    if (token.kind === 'image') return figure(token.url, token.alt, token.caption);
    return anchor(token.href, escapeHtml(token.label));
  });
}

/** Split a `| a | b |` row into its cells. */
function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  if (!line.includes('-')) return false;
  return tableCells(line).every((cell) => /^:?-{2,}:?$/.test(cell));
}

type Alignment = 'left' | 'center' | 'right' | null;

function alignmentOf(separatorCells: string[]): Alignment[] {
  return separatorCells.map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center' as const;
    if (right) return 'right' as const;
    if (left) return 'left' as const;
    return null;
  });
}

/** The HTML for one block of the document. Returns null when the block is not recognized. */
function renderBlock(lines: string[]): string | null {
  const first = lines[0] ?? '';
  const trimmed = first.trim();

  // Fenced code: ``` … ``` — content is text, never markup.
  const fence = trimmed.match(/^```(\S*)\s*$/);
  if (fence) {
    const body: string[] = [];
    let index = 1;
    for (; index < lines.length; index += 1) {
      if (/^\s*```\s*$/.test(lines[index])) break;
      body.push(lines[index]);
    }
    const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : '';
    return `<pre class="${CLASSES.pre}"><code${language}>${escapeHtml(body.join('\n'))}</code></pre>`;
  }

  // Headings. `#` is not in the toolbar on purpose — the page title is the H1 —
  // so a typed `#` renders at its literal level and shows the author what it is.
  const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    const level = Math.min(Math.max(heading[1].length, 2), 4);
    const tag = `h${level}`;
    const size = level === 2 ? CLASSES.h2 : level === 3 ? CLASSES.h3 : CLASSES.h4;
    return `<${tag} class="${size}">${renderInline(heading[2].trim())}</${tag}>`;
  }

  // Divider: a lone run of dashes (or asterisks). A separator under a paragraph
  // line would be a setext heading in CommonMark; the toolbar inserts dividers
  // as their own block, so treating a lone `---` as a rule matches what is written.
  if (/^(-{3,}|\*{3,})\s*$/.test(trimmed)) return `<hr class="${CLASSES.hr}" />`;

  // Table: a header row, then a separator row, then rows.
  if (trimmed.startsWith('|') && lines.length >= 2 && isTableSeparator(lines[1])) {
    const alignments = alignmentOf(tableCells(lines[1]));
    const header = tableCells(lines[0]);
    const style = (index: number): string => {
      const align = alignments[index];
      return align ? ` style="text-align: ${align}"` : '';
    };
    const head = header
      .map((cell, index) => `<th class="${CLASSES.th}"${style(index)}>${renderInline(cell)}</th>`)
      .join('');
    const rows = lines
      .slice(2)
      .filter((line) => line.trim().startsWith('|'))
      .map(
        (line) =>
          `<tr>${tableCells(line)
            .map((cell, index) => `<td class="${CLASSES.td}"${style(index)}>${renderInline(cell)}</td>`)
            .join('')}</tr>`
      )
      .join('');
    return `<div class="my-6 overflow-x-auto"><table class="${CLASSES.table}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // Blockquote: consecutive `> ` lines, one paragraph inside.
  if (trimmed.startsWith('>')) {
    const inner = lines
      .map((line) => line.trim().replace(/^>\s?/, ''))
      .filter((line) => line.length > 0)
      .map((line) => renderInline(line))
      .join('<br />');
    return `<blockquote class="${CLASSES.blockquote}">${inner}</blockquote>`;
  }

  // Lists: consecutive `- ` / `* ` or `1. ` lines, one level deep — the depth the
  // toolbar writes and the articles use.
  if (/^[-*]\s+/.test(trimmed)) {
    const items = lines
      .filter((line) => /^[-*]\s+/.test(line.trim()))
      .map((line) => `<li class="pl-1">${renderInline(line.trim().replace(/^[-*]\s+/, ''))}</li>`)
      .join('');
    return `<ul class="${CLASSES.ul}">${items}</ul>`;
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    const items = lines
      .filter((line) => /^\d+\.\s+/.test(line.trim()))
      .map((line) => `<li class="pl-1">${renderInline(line.trim().replace(/^\d+\.\s+/, ''))}</li>`)
      .join('');
    return `<ol class="${CLASSES.ol}">${items}</ol>`;
  }

  // Paragraph: a lone image becomes its own figure, like a CommonMark renderer
  // would emit it; anything else is one <p> with soft breaks preserved.
  const inline = renderInline(first);
  if (/^<figure class="/.test(inline) && lines.length === 1) return inline;
  return `<p class="${CLASSES.p}">${lines.map((line) => renderInline(line)).join('<br />')}</p>`;
}

/** The full body, as HTML the Preview tab can insert. */
export function renderPreview(markdown: string): string {
  /** What kind of block a line belongs to: only lines of one kind group together. */
  type BlockKind = 'paragraph' | 'ul' | 'ol' | 'quote' | 'table' | 'hr';
  const kindOf = (trimmed: string): BlockKind => {
    if (/^[-*]\s+/.test(trimmed)) return 'ul';
    if (/^\d+\.\s+/.test(trimmed)) return 'ol';
    if (trimmed.startsWith('>')) return 'quote';
    if (trimmed.startsWith('|')) return 'table';
    if (/^(-{3,}|\*{3,})\s*$/.test(trimmed)) return 'hr';
    return 'paragraph';
  };

  const blocks: string[] = [];
  let current: string[] = [];
  let currentKind: BlockKind = 'paragraph';

  const flush = (): void => {
    if (current.length === 0) return;
    const block = renderBlock(current);
    if (block) blocks.push(block);
    current = [];
  };

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    // A fenced block is gathered whole, blank lines and all, so code containing
    // empty lines stays one block.
    if (/^```/.test(trimmed)) {
      flush();
      const fenceLines = [line];
      index += 1;
      for (; index < lines.length; index += 1) {
        fenceLines.push(lines[index]);
        if (/^```\s*$/.test(lines[index].trim())) {
          index += 1;
          break;
        }
      }
      const block = renderBlock(fenceLines);
      if (block) blocks.push(block);
      continue;
    }

    if (trimmed.length === 0) {
      flush();
    } else {
      const kind = kindOf(trimmed);
      if (current.length > 0 && kind !== currentKind) flush();
      if (current.length === 0) currentKind = kind;
      current.push(line);
    }
    index += 1;
  }
  flush();

  return blocks.join('\n');
}
