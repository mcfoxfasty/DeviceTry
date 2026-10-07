/**
 * HTML → Markdown, in the browser bundle, with no dependencies.
 *
 * TWO CALLERS, ONE CONVERTER.
 *  1. **Pasting.** A paste from a word processor, a browser or a rendered document
 *     arrives as HTML with its formatting in tags and `style` attributes. Reading
 *     only `text/plain` throws that away — a pasted table becomes a column of words,
 *     a pasted list becomes sentences — so the editor converts the HTML clipboard
 *     flavour instead and keeps the structure the author could see on the page they
 *     copied from.
 *  2. **The HTML / Source Code view.** Switching the body to its HTML source and
 *     editing it there is only honest if the edit can come back: the body the site
 *     builds is Markdown, so the editor converts the HTML back when the author
 *     leaves that view. The same function does both jobs, so what a paste produces
 *     and what the source view round-trips are the same Markdown.
 *
 * WHY NOT A LIBRARY. The body this has to handle is exactly the set the toolbar
 * writes and the schema promises (POST_EDITOR_OPTIONS in keystatic.config.ts):
 * headings, emphasis, lists, tables, blockquotes, fenced code, links, images,
 * dividers. A general-purpose converter brings a DOM, a plugin pipeline and a
 * different answer for every construct on every release — which would mean the
 * editor's round trip could change under the site's feet. This handles that set, and
 * says so: anything outside it becomes text rather than being silently dropped.
 *
 * NO DOM, DELIBERATELY. It runs on a string, in Node under the test runner and in
 * the browser without a parser to initialise. That is also what makes
 * `htmlToMarkdown(renderPreview(markdown))` — the round trip the source view
 * depends on — assertable in a test instead of only observable in a browser.
 *
 * NOTHING IS EVER EMITTED UNESCAPED. Every attribute this writes (an href, an
 * image's src and alt) is taken from the parsed HTML and re-emitted as Markdown
 * syntax; text runs are unescaped from their entities and passed through. It writes
 * no HTML, so there is no path here that produces markup the site would render.
 *
 * THE HEADING CEILING IS THE SCHEMA'S. The body's H1 is the page title, so an `h1`
 * in pasted HTML becomes `##` — the level the toolbar offers — rather than a `#`
 * that the editor's own preview would render as a second H1.
 */

/** The heading levels the body may use, and where pasted headings land. */
export const MIN_BODY_HEADING = 2;
export const MAX_BODY_HEADING = 4;

interface ElementNode {
  kind: 'element';
  /** Lowercase tag name. */
  name: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

interface TextNode {
  kind: 'text';
  text: string;
}

type HtmlNode = ElementNode | TextNode;

/** Tags that never have children, so an unclosed one cannot swallow the document. */
const VOID_ELEMENTS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'col', 'area', 'base']);

/** Containers whose content is not article text at all. */
const DROPPED_ELEMENTS = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'svg']);

/** Elements that start a new block when they appear. */
const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'dd', 'dt', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p',
  'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);

const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;

/** The decoded value of an HTML entity reference, or `null` when it is not one. */
function decodeEntity(entity: string): string | null {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
    hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', times: '×',
    deg: '°', copy: '©', reg: '®', trade: '™',
  };
  if (entity.startsWith('#')) {
    const isHex = entity[1] === 'x' || entity[1] === 'X';
    const code = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : null;
  }
  return named[entity] ?? null;
}

/** Entities → characters, so `&amp;` does not reach an article as `&amp;`. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity: string) => decodeEntity(entity) ?? match);
}

/** A tag's attributes, as written — lowercased names, decoded values. */
export function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let match = ATTRIBUTE.exec(source);
  while (match) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (name !== '/') attrs[name] = decodeEntities(value);
    match = ATTRIBUTE.exec(source);
  }
  return attrs;
}

/** One `style` declaration's value, lowercased and stripped of `!important`. */
export function styleValue(style: string | undefined, property: string): string {
  if (!style) return '';
  for (const declaration of style.split(';')) {
    const at = declaration.indexOf(':');
    if (at === -1) continue;
    if (declaration.slice(0, at).trim().toLowerCase() !== property) continue;
    return declaration.slice(at + 1).replace(/!important/gi, '').trim().toLowerCase();
  }
  return '';
}

/**
 * Parse an HTML fragment into a node tree.
 *
 * A close tag that does not match any open element is ignored rather than popping
 * the stack: pasted HTML from a word processor is routinely unbalanced, and closing
 * an ancestor on a stray `</span>` would move the rest of the document inside the
 * wrong element.
 */
export function parseHtml(html: string): HtmlNode[] {
  const root: ElementNode = { kind: 'element', name: '#root', attrs: {}, children: [] };
  const stack: ElementNode[] = [root];
  const top = (): ElementNode => stack[stack.length - 1]!;
  const push = (node: HtmlNode): void => {
    top().children.push(node);
  };

  let cursor = 0;
  TAG.lastIndex = 0;
  let match = TAG.exec(html);
  while (match) {
    const [whole, rawName, rawAttrs, selfClosing] = match;
    const text = html.slice(cursor, match.index);
    if (text.length > 0) push({ kind: 'text', text: decodeEntities(text) });
    cursor = match.index + whole.length;

    if (whole.startsWith('<!')) {
      // A comment or a doctype is not markup this document keeps.
      match = TAG.exec(html);
      continue;
    }

    const name = rawName.toLowerCase();
    if (whole.startsWith('</')) {
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index]!.name === name) {
          stack.length = index;
          break;
        }
      }
    } else if (VOID_ELEMENTS.has(name) || selfClosing === '/') {
      push({ kind: 'element', name, attrs: parseAttributes(rawAttrs), children: [] });
    } else if (DROPPED_ELEMENTS.has(name)) {
      // Skip the element and everything inside it.
      const closer = new RegExp(`</${name}\\s*>`, 'i');
      const rest = html.slice(cursor);
      const found = rest.search(closer);
      if (found !== -1) cursor += found + (rest.match(closer)?.[0].length ?? 0);
    } else {
      const element: ElementNode = { kind: 'element', name, attrs: parseAttributes(rawAttrs), children: [] };
      push(element);
      stack.push(element);
    }
    match = TAG.exec(html);
  }

  const tail = html.slice(cursor);
  if (tail.length > 0) push({ kind: 'text', text: decodeEntities(tail) });
  return root.children;
}

// ------------------------------------------------------------------ rendering

const collapse = (value: string): string => value.replace(/\s+/g, ' ');

/**
 * A text run, made safe to put in a Markdown body.
 *
 * `<` is escaped, and that is the one escaping this converter does. The bodies it
 * produces are compiled as MDX (`components/blog/PostBody.tsx`), where a raw `<tag>`
 * in the text is a JSX element rather than a character — so a pasted sentence
 * containing `<script>` must not arrive as a tag. `\<` renders as `<` on the page,
 * which is what the author copied, and it is the escape CommonMark already defines.
 */
function escapeText(value: string): string {
  return value.replace(/</g, '\\<');
}

/** Whether a node's content is a block of its own (rather than inline text). */
function isBlock(node: HtmlNode): boolean {
  return node.kind === 'element' && BLOCK_ELEMENTS.has(node.name);
}

/**
 * The bold/italic/strike a word processor declares in a `style` attribute instead
 * of in tags — which is how Google Docs and Word express most formatting.
 */
function styleMarkers(attrs: Record<string, string>): { open: string; close: string } {
  const style = attrs.style ?? '';
  const weight = styleValue(style, 'font-weight');
  const italic = styleValue(style, 'font-style').startsWith('italic') || styleValue(style, 'font-style').startsWith('oblique');
  const strike = styleValue(style, 'text-decoration').includes('line-through');

  let open = '';
  let close = '';
  if (weight === 'bold' || weight === 'bolder' || Number.parseInt(weight, 10) >= 600) {
    open += '**';
    close = `**${close}`;
  }
  if (italic) {
    open += '_';
    close = `_${close}`;
  }
  if (strike) {
    open += '~~';
    close = `~~${close}`;
  }
  return { open, close };
}

/** One node's inline content, as Markdown. */
function renderInline(node: HtmlNode): string {
  if (node.kind === 'text') return escapeText(node.text.replace(/\s+/g, ' '));
  const { name, attrs, children } = node;
  const inner = children.map(renderInline).join('');

  switch (name) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b': {
      const text = inner.trim();
      return text.length > 0 ? `**${text}**` : '';
    }
    case 'em':
    case 'i': {
      const text = inner.trim();
      return text.length > 0 ? `_${text}_` : '';
    }
    case 'del':
    case 's':
    case 'strike': {
      const text = inner.trim();
      return text.length > 0 ? `~~${text}~~` : '';
    }
    case 'code':
      return inner.length > 0 ? `\`${inner.replace(/`/g, '')}\`` : '';
    case 'a': {
      const href = (attrs.href ?? '').trim();
      const label = collapse(inner).trim();
      if (label.length === 0) return '';
      return href.length > 0 ? `[${label}](${href})` : label;
    }
    case 'img':
      return imageMarkdown(attrs);
    // Underline and its siblings have no Markdown, so the text is kept and the
    // decoration is not invented. A `span` may still carry the formatting, which is
    // how every word processor's clipboard expresses bold.
    case 'u':
    case 'span':
    case 'font':
    case 'small':
    case 'mark':
    case 'sub':
    case 'sup':
    case 'label':
    case 'abbr':
    case 'cite':
    case 'time':
    case 'kbd':
    case 'var':
    case 'samp':
    case 'q': {
      const { open, close } = styleMarkers(attrs);
      if (!open) return inner;
      const text = inner.trim();
      return text.length === 0 ? '' : `${open}${text}${close}`;
    }
    default:
      return inner;
  }
}

/**
 * An `<img>` as Markdown, folding its events and sizes away.
 *
 * The caption is the Markdown *title* (the quoted part), which is where
 * components/blog/PostBody.tsx promotes it back into a visible `<figcaption>` — so a
 * caption survives a paste from a document that had one.
 */
function imageMarkdown(attrs: Record<string, string>, caption?: string): string {
  const src = (attrs.src ?? '').trim();
  if (src.length === 0) return '';
  const alt = collapse(attrs.alt ?? '').trim();
  const title = collapse(caption ?? attrs.title ?? '').trim();
  return title.length > 0
    ? `![${alt}](${src} '${title.replace(/'/g, "\\'")}')`
    : `![${alt}](${src})`;
}

/** The text of a set of nodes, collapsed, with images handled inline. */
function inlineText(nodes: HtmlNode[]): string {
  return collapse(nodes.map(renderInline).join('')).trim();
}

/** A cell's alignment, from the `style`/`align` a word processor writes. */
function cellAlignment(attrs: Record<string, string>): 'left' | 'center' | 'right' | null {
  const declared = styleValue(attrs.style, 'text-align') || (attrs.align ?? '').toLowerCase();
  return declared === 'left' || declared === 'center' || declared === 'right' ? declared : null;
}

/** A `<ul>`/`<ol>`, one level of nesting included — the depth the toolbar writes. */
function renderList(list: ElementNode, depth: number): string[] {
  const ordered = list.name === 'ol';
  const lines: string[] = [];
  let index = 1;

  for (const child of list.children) {
    if (child.kind !== 'element' || child.name !== 'li') continue;
    const nested = child.children.filter(
      (node): node is ElementNode => node.kind === 'element' && (node.name === 'ul' || node.name === 'ol')
    );
    const own = child.children.filter(
      (node) => !(node.kind === 'element' && (node.name === 'ul' || node.name === 'ol'))
    );
    lines.push(`${'  '.repeat(depth)}${ordered ? `${index}. ` : '- '}${inlineText(own)}`.trimEnd());
    for (const sub of nested) lines.push(...renderList(sub, depth + 1));
    index += 1;
  }

  return lines.length > 0 ? [lines.join('\n')] : [];
}

/** A `<table>` as a GitHub-flavoured Markdown table, with its alignment kept. */
function renderTable(table: ElementNode): string {
  const rows: Array<{ cells: string[]; alignments: Array<'left' | 'center' | 'right' | null>; header: boolean }> = [];

  const collect = (nodes: HtmlNode[]): void => {
    for (const node of nodes) {
      if (node.kind !== 'element') continue;
      if (node.name === 'tr') {
        const cells: string[] = [];
        const alignments: Array<'left' | 'center' | 'right' | null> = [];
        let header = false;
        for (const cell of node.children) {
          if (cell.kind !== 'element' || (cell.name !== 'td' && cell.name !== 'th')) continue;
          header = header || cell.name === 'th';
          cells.push(inlineText(cell.children).replace(/\|/g, '\\|'));
          alignments.push(cellAlignment(cell.attrs));
        }
        if (cells.length > 0) rows.push({ cells, alignments, header });
      } else if (node.name === 'thead' || node.name === 'tbody' || node.name === 'tfoot') {
        collect(node.children);
      }
    }
  };
  collect(table.children);
  if (rows.length === 0) return '';

  // Markdown needs a header row. A table that declares one keeps it; a table that
  // does not gets its first row promoted, which is the only way to express it — and
  // is what a paste from every word processor expects to see.
  const header = rows.find((row) => row.header) ?? rows[0]!;
  const body = rows.filter((row) => row !== header);
  const width = Math.max(...rows.map((row) => row.cells.length));

  // Every row is padded to the widest one: a Markdown table with a short row loses
  // its alignment, because the separator row is positional.
  const pad = <T>(cells: Array<T | undefined>, fallback: T): T[] =>
    Array.from({ length: width }, (_, index) => cells[index] ?? fallback);
  const separator = pad(header.alignments, null).map((alignment) =>
    alignment === 'left' ? ':---' : alignment === 'right' ? '---:' : alignment === 'center' ? ':---:' : '---'
  );

  return [
    `| ${pad(header.cells, '').join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((row) => `| ${pad(row.cells, '').join(' | ')} |`),
  ].join('\n');
}

/**
 * A `<figure>`, as the image (with its caption as the Markdown title) and any other
 * blocks it holds.
 *
 * The caption is a SIBLING of the image, which is why a figure is handled as a unit
 * rather than by the `<img>` rule: by the time the image is rendered there is no
 * caption to attach to it yet, and a `figcaption` rendered as its own paragraph is a
 * caption the site would then print twice.
 */
function renderFigure(figure: ElementNode): string[] {
  // The caption is read FIRST: it is a sibling that comes after the image, and an
  // image rendered before its caption exists is an image with no caption title.
  const captionNode = figure.children.find(
    (node): node is ElementNode => node.kind === 'element' && node.name === 'figcaption'
  );
  const caption = captionNode ? inlineText(captionNode.children) : undefined;

  const blocks: string[] = [];
  for (const child of figure.children) {
    if (child === captionNode) continue;

    // The renderer wraps a linked image in an anchor; the image inside it is still
    // the figure's content, and the link is kept around it.
    const image = findImage(child);
    if (image) {
      const markdown = imageMarkdown(image.attrs, caption);
      if (markdown.length > 0) {
        const wrapped = child.kind === 'element' && child.name === 'a' ? `[${markdown}](${child.attrs.href ?? ''})` : markdown;
        blocks.push(wrapped);
      }
      continue;
    }
    blocks.push(...renderBlocks([child]));
  }

  // A caption whose image never appeared is still the figure's text.
  if (blocks.length === 0 && caption && caption.length > 0) blocks.push(caption);
  return blocks;
}

/** The `<img>` a node is, or the one it wraps. */
function findImage(node: HtmlNode): ElementNode | null {
  if (node.kind !== 'element') return null;
  if (node.name === 'img') return node;
  if (node.name === 'a' || node.name === 'p' || node.name === 'figure') {
    return node.children.find((child): child is ElementNode => child.kind === 'element' && child.name === 'img') ?? null;
  }
  return null;
}

/** Every block inside a set of nodes, as Markdown blocks. */
function renderBlocks(nodes: HtmlNode[]): string[] {
  const blocks: string[] = [];

  for (const node of nodes) {
    if (node.kind === 'text') {
      const text = collapse(node.text).trim();
      if (text.length > 0) blocks.push(escapeText(text));
      continue;
    }

    const { name, children } = node;

    if (/^h[1-6]$/.test(name)) {
      const level = Math.min(Math.max(Number(name.slice(1)), MIN_BODY_HEADING), MAX_BODY_HEADING);
      const text = inlineText(children);
      if (text.length > 0) blocks.push(`${'#'.repeat(level)} ${text}`);
      continue;
    }

    if (name === 'p' || name === 'figcaption' || name === 'dd' || name === 'dt') {
      const text = children
        .map(renderInline)
        .join('')
        .replace(/[ \t]+/g, ' ')
        .trim()
        // A paragraph's soft line breaks are Markdown's own: the preview joins a
        // paragraph's lines with <br>, and two trailing spaces are how Markdown
        // expresses a break inside a paragraph rather than a break between them.
        .replace(/\n/g, '  \n');
      if (text.length > 0) blocks.push(text);
      continue;
    }

    if (name === 'hr') {
      blocks.push('---');
      continue;
    }

    if (name === 'pre') {
      // A fenced block, with the language the renderer put on the inner <code>.
      const code = children.find((child): child is ElementNode => child.kind === 'element' && child.name === 'code');
      const language = (code?.attrs.class ?? '').match(/language-([A-Za-z0-9+#-]+)/)?.[1] ?? '';
      const body = (code ? code.children : children)
        .map((child) => (child.kind === 'text' ? child.text : renderInline(child)))
        .join('')
        .replace(/^\n/, '')
        .replace(/\n$/, '');
      blocks.push(['```' + language, body, '```'].join('\n'));
      continue;
    }

    if (name === 'blockquote') {
      const inner = renderBlocks(children)
        .join('\n\n')
        .split('\n')
        .map((line) => (line.length > 0 ? `> ${line}` : '>'))
        .join('\n');
      if (inner.trim().length > 0) blocks.push(inner);
      continue;
    }

    if (name === 'ul' || name === 'ol') {
      blocks.push(...renderList(node, 0));
      continue;
    }

    if (name === 'table') {
      const table = renderTable(node);
      if (table) blocks.push(table);
      continue;
    }

    if (name === 'figure') {
      blocks.push(...renderFigure(node));
      continue;
    }

    if (name === 'br') continue;

    if (BLOCK_ELEMENTS.has(name)) {
      // A container is transparent when it holds blocks and a paragraph when it
      // holds only inline content — which is how `<div>one line</div>` from a word
      // processor becomes a paragraph rather than a lost line.
      if (children.some(isBlock)) {
        blocks.push(...renderBlocks(children));
      } else {
        const text = inlineText(children);
        if (text.length > 0) blocks.push(text);
      }
      continue;
    }

    // An inline element at the top level of a fragment is still a paragraph.
    const text = inlineText([node]);
    if (text.length > 0) blocks.push(text);
  }

  return blocks.filter((block) => block.trim().length > 0);
}

/** The whole converter: an HTML fragment as Markdown, in the editor's own dialect. */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim().length === 0) return '';
  const blocks = renderBlocks(parseHtml(html));
  const markdown = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return markdown.length === 0 ? '' : `${markdown}\n`;
}
