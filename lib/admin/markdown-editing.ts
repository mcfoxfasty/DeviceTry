/**
 * The editor's text operations, as pure functions.
 *
 * The dashboard's toolbar is a set of buttons over a plain Markdown textarea.
 * That is a deliberate choice over a WYSIWYG widget: this is a phone-first admin
 * (the whole point of replacing the previous dashboard was mobile reliability), and
 * a textarea plus a few buttons behaves identically in iOS Safari, on Android and
 * on the desktop, needs no contenteditable handling, and cannot corrupt the
 * document.
 *
 * Keeping the operations here — rather than inside the component — means the
 * exact Markdown each button produces is asserted by tests, including the two
 * rules that matter for the published article: headings are limited to H2/H3/H4
 * (the page's H1 is the title, so a second H1 in the body is an accessibility
 * defect) and an image cannot be inserted without alt text.
 */

/** A textarea's value and selection, which is all an operation needs. */
export interface EditState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** The value and selection after an operation, ready to write back. */
export interface EditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** The heading levels the article body may use. H1 belongs to the page title. */
export const ALLOWED_HEADING_LEVELS = [2, 3, 4] as const;
export type HeadingLevel = (typeof ALLOWED_HEADING_LEVELS)[number];

/** Wrap the selection in a marker, or unwrap it when it is already wrapped. */
export function toggleWrap(state: EditState, marker: string): EditResult {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);

  // Already wrapped, including when the selection is just the inner text.
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return {
      value: `${before}${inner}${after}`,
      selectionStart,
      selectionEnd: selectionStart + inner.length,
    };
  }
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const value2 = `${before.slice(0, -marker.length)}${selected}${after.slice(marker.length)}`;
    return {
      value: value2,
      selectionStart: selectionStart - marker.length,
      selectionEnd: selectionEnd - marker.length,
    };
  }

  const wrapped = `${marker}${selected || 'text'}${marker}`;
  return {
    value: `${before}${wrapped}${after}`,
    selectionStart: selectionStart + marker.length,
    selectionEnd: selectionStart + marker.length + (selected || 'text').length,
  };
}

/**
 * Apply a line prefix (heading, quote, list item) to every touched line.
 *
 * Clicking the same prefix twice removes it, which is what a writer expects from
 * a toolbar that has no other way to undo a heading.
 */
export function prefixLines(state: EditState, prefix: string): EditResult {
  const { value, selectionStart, selectionEnd } = state;
  const start = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const endOfSelection = value.indexOf('\n', selectionEnd);
  const end = endOfSelection === -1 ? value.length : endOfSelection;
  const block = value.slice(start, end);
  const lines = block.split('\n');

  const everyLineHasIt = lines.every((line) => line.startsWith(prefix));
  const rewritten = lines
    .map((line) => (everyLineHasIt ? line.slice(prefix.length) : `${prefix}${line.replace(/^(#{1,6}\s|>\s|[-*]\s|\d+\.\s)/, '')}`))
    .join('\n');

  const delta = rewritten.length - block.length;
  return {
    value: `${value.slice(0, start)}${rewritten}${value.slice(end)}`,
    selectionStart: start,
    selectionEnd: Math.max(start, selectionEnd + delta),
  };
}

/** Insert text at the cursor, selecting it when it is a placeholder. */
export function insertText(state: EditState, text: string, selectInserted = false): EditResult {
  const { value, selectionStart, selectionEnd } = state;
  return {
    value: `${value.slice(0, selectionStart)}${text}${value.slice(selectionEnd)}`,
    selectionStart: selectInserted ? selectionStart : selectionStart + text.length,
    selectionEnd: selectInserted ? selectionStart + text.length : selectionStart + text.length,
  };
}

/**
 * A Markdown image, with its alt text and optional caption.
 *
 * The caption is written as the Markdown title (the quoted part), which is what
 * components/blog/PostBody.tsx promotes to a visible `<figcaption>` — so a caption
 * cannot be lost by the renderer.
 */
export function imageMarkdown(url: string, alt: string, caption?: string): string {
  const safeAlt = alt.replace(/[[\]]/g, '');
  const title = (caption ?? '').trim();
  return title ? `![${safeAlt}](${url} '${title.replace(/'/g, "\\'")}')` : `![${safeAlt}](${url})`;
}

/** Insert an image, isolating it on its own lines so it never joins a paragraph. */
export function insertImage(
  state: EditState,
  url: string,
  alt: string,
  caption?: string
): EditResult {
  const { value, selectionStart, selectionEnd } = state;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const needsLeadingBreak = before.length > 0 && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const needsTrailingBreak = after.length > 0 && !after.startsWith('\n') ? '\n\n' : '\n';
  const markdown = `${needsLeadingBreak}${imageMarkdown(url, alt, caption)}${needsTrailingBreak}`;
  const caret = before.length + markdown.length;
  return { value: `${before}${markdown}${after}`, selectionStart: caret, selectionEnd: caret };
}

/**
 * Insert one block of Markdown on its own lines.
 *
 * Used by the table, code-block, blockquote and divider buttons: each is a
 * multi-line construct that must not be spliced into the middle of a paragraph.
 */
export function insertBlock(state: EditState, block: string): EditResult {
  const { value, selectionStart, selectionEnd } = state;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const leading = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trailing = after.length === 0 || after.startsWith('\n') ? '\n' : '\n\n';
  const inserted = `${leading}${block}${trailing}`;
  return {
    value: `${before}${inserted}${after}`,
    selectionStart: before.length + leading.length,
    selectionEnd: before.length + leading.length + block.length,
  };
}

/** A GitHub-flavoured Markdown table with a header row and one empty body row. */
export function tableTemplate(): string {
  return ['| Column | Column |', '| --- | --- |', '|  |  |'].join('\n');
}

/** A fenced code block. `powershell` matches the site's existing articles. */
export function codeBlockTemplate(language = 'powershell'): string {
  return ['```' + language, '', '```'].join('\n');
}

/** Every image reference in a Markdown body, as `{ alt, url }`. */
export function imageReferences(markdown: string): Array<{ alt: string; url: string }> {
  const found: Array<{ alt: string; url: string }> = [];
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+'[^']*')?\)/g;
  let match = pattern.exec(markdown);
  while (match) {
    found.push({ alt: match[1], url: match[2] });
    match = pattern.exec(markdown);
  }
  return found;
}
