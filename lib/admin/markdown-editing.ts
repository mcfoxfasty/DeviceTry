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

// ---------------------------------------------------------------- undo / redo

/**
 * The editor's undo history, as a pure data structure.
 *
 * WHY THE BROWSER'S OWN UNDO IS NOT ENOUGH. The toolbar edits the document
 * programmatically — it rewrites the textarea's value — and a browser's undo stack
 * only knows about the changes the USER made: after a toolbar action, Ctrl+Z in
 * Chrome undoes the typing from before it and leaves the toolbar's change in place,
 * which is worse than doing nothing. So the editor keeps its own stack of states,
 * and the buttons and the shortcuts both go through it.
 *
 * WHAT IS RECORDED, AND WHEN. Every state the document was in before a change that
 * the toolbar or a paste made is pushed. Typing is pushed too, but COALESCED: a
 * snapshot taken within `TYPING_COALESCE_MS` of the previous one replaces nothing
 * and adds nothing, so a burst of typing is one undo step — which is what every
 * editor's Ctrl+Z does, and what stops a 400-word paragraph from becoming 400
 * presses.
 *
 * WHAT AN UNDO RESTORES. The value AND the selection. Restoring the text without the
 * caret puts the cursor at the end of the document, so an author who undoes a
 * formatting change then types gets their words in the wrong place.
 */
export interface History { past: EditState[]; future: EditState[]; lastAt: number }

/** A coarse cap: the states are a few hundred bytes each, and nobody needs 200. */
export const MAX_HISTORY = 100;

/** Typing within this window of the last snapshot is one undo step. */
export const TYPING_COALESCE_MS = 600;

/** An empty history — nothing to undo, nothing to redo. */
export function emptyHistory(): History {
  return { past: [], future: [], lastAt: 0 };
}

/**
 * Record the state a change is ABOUT to replace.
 *
 * Any redo stack is dropped: once a new change is made, the states that were undone
 * are no longer reachable, and keeping them would let Redo jump to a document that
 * never existed.
 */
export function record(history: History, state: EditState, at: number, coalesceMs = 0): History {
  const snapshot: EditState = {
    value: state.value,
    selectionStart: state.selectionStart,
    selectionEnd: state.selectionEnd,
  };
  if (coalesceMs > 0 && history.past.length > 0 && at - history.lastAt <= coalesceMs) {
    // The same burst of typing: the earlier snapshot already holds the state this
    // one would replace, so only the clock moves.
    return { past: history.past, future: [], lastAt: at };
  }
  return { past: [...history.past, snapshot].slice(-MAX_HISTORY), future: [], lastAt: at };
}

/** The state to restore for an undo, and the history that follows from it. */
export function undo(
  history: History,
  current: EditState
): { history: History; state: EditState } | null {
  const previous = history.past[history.past.length - 1];
  if (!previous) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, MAX_HISTORY),
      lastAt: 0,
    },
    state: previous,
  };
}

/** The state to restore for a redo, and the history that follows from it. */
export function redo(
  history: History,
  current: EditState
): { history: History; state: EditState } | null {
  const [next, ...rest] = history.future;
  if (!next) return null;
  return {
    history: {
      past: [...history.past, current].slice(-MAX_HISTORY),
      future: rest,
      lastAt: 0,
    },
    state: next,
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
