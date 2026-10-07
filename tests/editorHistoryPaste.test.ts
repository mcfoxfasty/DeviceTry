/**
 * The editor's undo stack, and the HTML ⇄ Markdown conversion behind both the rich
 * paste and the HTML / Source tab.
 *
 * Three properties carry the weight here:
 *
 *  1. an undo restores the TEXT and the CARET, in the order the changes were made,
 *     and a burst of typing is one step rather than one per keystroke;
 *  2. a paste keeps the structure the author copied — tables, lists, emphasis,
 *     inline styles — and never invents markup;
 *  3. the body round-trips: `htmlToMarkdown(renderPreview(markdown))` gives the
 *     Markdown back, which is what makes the HTML / Source tab safe to have.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_HISTORY,
  TYPING_COALESCE_MS,
  emptyHistory,
  record,
  redo,
  undo,
  type EditState,
} from '../lib/admin/markdown-editing';
import {
  MAX_BODY_HEADING,
  MIN_BODY_HEADING,
  decodeEntities,
  htmlToMarkdown,
  parseAttributes,
  styleValue,
} from '../lib/admin/html-to-markdown';
import { renderPreview } from '../lib/admin/preview';

const state = (value: string, selectionStart = 0, selectionEnd = 0): EditState => ({
  value,
  selectionStart,
  selectionEnd,
});

// ------------------------------------------------------------- undo history

test('history - an undo restores the text and the caret, newest change first', () => {
  let history = emptyHistory();
  history = record(history, state('one', 3, 3), 1000);
  history = record(history, state('one two', 7, 7), 2000);

  const first = undo(history, state('one two three', 13, 13));
  assert.ok(first);
  assert.equal(first.state.value, 'one two');
  assert.deepEqual([first.state.selectionStart, first.state.selectionEnd], [7, 7], 'the caret comes back too');

  const second = undo(first.history, first.state);
  assert.ok(second);
  assert.equal(second.state.value, 'one');
  assert.equal(undo(second.history, second.state), null, 'an empty stack is not an undo');
});

test('history - redo walks the undos back, and a new change drops the redo stack', () => {
  let history = record(emptyHistory(), state('one'), 1000);
  const undone = undo(history, state('one two'));
  assert.ok(undone);
  history = undone.history;

  const redone = redo(history, state('one'));
  assert.ok(redone);
  assert.equal(redone.state.value, 'one two');
  assert.equal(redo(redone.history, redone.state), null, 'nothing left to redo');

  // A change made after an undo makes the undone state unreachable.
  const afterEdit = record(redone.history, state('one'), 3000);
  assert.equal(afterEdit.future.length, 0);
  assert.deepEqual(
    redo(afterEdit, state('something else')),
    null,
    'redo must never jump to a document that never existed'
  );
});

test('history - a burst of typing is one step, a pause starts another', () => {
  let history = record(emptyHistory(), state('He'), 10_000);
  const pastAfterFirst = history.past.length;

  // Continuous typing: each keystroke within the window of the one before it, and
  // each recording the value it replaced.
  history = record(history, state('Hel'), 10_000 + 200, TYPING_COALESCE_MS);
  history = record(history, state('Hell'), 10_000 + 400, TYPING_COALESCE_MS);
  assert.equal(history.past.length, pastAfterFirst, 'a keystroke in the same burst adds no step');

  // A real pause — longer than the window — ends the burst and starts a new one.
  const afterPause = 10_000 + 400 + TYPING_COALESCE_MS + 1;
  history = record(history, state('Hello'), afterPause, TYPING_COALESCE_MS);
  assert.equal(history.past.length, pastAfterFirst + 1, 'a pause starts a new step');

  const one = undo(history, state('Hello world'));
  assert.ok(one);
  assert.equal(one.state.value, 'Hello', 'one undo takes back the typing since the pause');

  const two = undo(one.history, one.state);
  assert.ok(two);
  assert.equal(two.state.value, 'He', 'and the next takes back the whole burst before it');
});

test('history - a toolbar change is always its own step, and the stack is bounded', () => {
  // Coalescing is opt-in: the toolbar passes no window, so two clicks in the same
  // millisecond are still two undos — which is what a button expects.
  let history = record(emptyHistory(), state('a'), 5);
  history = record(history, state('b'), 5);
  assert.equal(history.past.length, 2);

  let long = emptyHistory();
  for (let index = 0; index < MAX_HISTORY + 40; index += 1) {
    long = record(long, state(`value ${index}`), index);
  }
  assert.equal(long.past.length, MAX_HISTORY, 'the oldest states are dropped, not kept forever');
});

// --------------------------------------------------------------- conversion

test('converter - tags and entities are read, attributes included', () => {
  assert.equal(decodeEntities('R&amp;D &mdash; 5 &lt; 6 &nbsp;done'), 'R&D — 5 < 6  done');
  assert.equal(decodeEntities('&#8212;'), '—', 'a numeric reference is decoded too');
  assert.deepEqual(parseAttributes(' href="/guides/x" target="_blank" data-x=1'), {
    href: '/guides/x',
    target: '_blank',
    'data-x': '1',
  });
  assert.equal(styleValue('color: red; font-weight: 700 !important', 'font-weight'), '700');
  assert.equal(styleValue(undefined, 'font-weight'), '');
});

test('converter - a pasted document keeps its headings, lists, emphasis and links', () => {
  const markdown = htmlToMarkdown(`
    <h1>Testing a microphone</h1>
    <p>The <strong>level</strong> meter is not an <em>SPL</em> measurement — see
       <a href="https://example.com/docs">the docs</a> and <s>ignore</s> the rest.</p>
    <ul><li>one</li><li>two</li></ul>
    <ol><li>first</li><li>second</li></ol>
    <blockquote><p>Measure before you change anything.</p></blockquote>
    <pre><code class="language-powershell">Get-PnpDevice</code></pre>
    <hr />
  `);

  assert.match(markdown, /^## Testing a microphone$/m, 'a pasted h1 lands at the body’s own top level');
  assert.match(markdown, /The \*\*level\*\* meter is not an _SPL_ measurement/);
  assert.match(markdown, /\[the docs\]\(https:\/\/example\.com\/docs\)/);
  assert.match(markdown, /~~ignore~~/);
  assert.match(markdown, /^- one\n- two$/m);
  assert.match(markdown, /^1\. first\n2\. second$/m);
  assert.match(markdown, /^> Measure before you change anything\.$/m);
  assert.match(markdown, /```powershell\nGet-PnpDevice\n```/);
  assert.match(markdown, /^---$/m);
  assert.doesNotMatch(markdown, /<h1|<ul|<strong|<script/, 'no HTML survives into the body');
});

test('converter - a pasted table becomes a Markdown table, alignment and all', () => {
  const markdown = htmlToMarkdown(`
    <table>
      <thead><tr><th>What it shows</th><th style="text-align: right">Meaning</th></tr></thead>
      <tbody>
        <tr><td>Nothing</td><td style="text-align: right">Hardware</td></tr>
        <tr><td>A quiet signal</td><td style="text-align: right">Gain</td></tr>
      </tbody>
    </table>
  `);

  assert.equal(
    markdown.trim(),
    [
      '| What it shows | Meaning |',
      '| --- | ---: |',
      '| Nothing | Hardware |',
      '| A quiet signal | Gain |',
    ].join('\n')
  );
});

test('converter - a table with no header row is promoted rather than dropped', () => {
  const markdown = htmlToMarkdown('<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>');
  assert.equal(markdown.trim().split('\n')[0], '| a | b |');
  assert.equal(markdown.trim().split('\n')[1], '| --- | --- |');
  assert.equal(markdown.trim().split('\n')[2], '| 1 | 2 |');
});

test('converter - a word processor’s inline styles become real emphasis', () => {
  // Google Docs and Word express most formatting as a style attribute rather than
  // as tags, which is the case a text/plain paste loses entirely.
  const markdown = htmlToMarkdown(
    '<p>a <span style="font-weight: 700">bold</span> and <span style="FONT-STYLE: italic">slanted</span> and ' +
      '<span style="text-decoration: line-through">struck</span> word</p>'
  );
  assert.match(markdown, /a \*\*bold\*\* and _slanted_ and ~~struck~~ word/);
});

test('converter - a figure’s caption is the image title, so it survives as a caption', () => {
  const markdown = htmlToMarkdown(
    `<figure><img src="/uploads/x.png" alt="A worn switch" /><figcaption>Figure 1. The switch</figcaption></figure>`
  );
  assert.equal(markdown.trim(), "![A worn switch](/uploads/x.png 'Figure 1. The switch')");
});

test('converter - script and style content never reaches the article', () => {
  const markdown = htmlToMarkdown(
    '<p>kept</p><script>alert(1)</script><style>p{color:red}</style><p>also kept</p>'
  );
  assert.match(markdown, /kept/);
  assert.doesNotMatch(markdown, /alert|color:red/);
});

test('converter - an unbalanced paste cannot swallow the rest of the document', () => {
  // A browser copy is routinely unbalanced; a stray close tag must not move the
  // rest of the content inside the wrong element.
  const markdown = htmlToMarkdown('<p>one</span></p><p>two</p>');
  assert.match(markdown, /one/);
  assert.match(markdown, /two/);
  assert.ok(markdown.indexOf('one') < markdown.indexOf('two'), 'order is kept');
});

test('converter - pasted text cannot become markup in an MDX body', () => {
  const markdown = htmlToMarkdown('<p>a &lt;script&gt;alert(1)&lt;/script&gt; and &lt;img src=x&gt;</p>');

  // Every `<` is escaped, so nothing the converter emits can open a tag — which
  // matters because a body is compiled as MDX, where a raw tag is an element.
  assert.doesNotMatch(markdown, /(^|[^\\])</, 'no unescaped angle bracket is emitted');
  assert.match(markdown, /\\<script>alert\(1\)\\<\/script>/, 'the text is kept, escaped, and reads as text');
  assert.equal(
    htmlToMarkdown('<p>a <b>b</b></p>'),
    'a **b**\n',
    'and a real tag still becomes real formatting'
  );
});

// -------------------------------------------------------------- round trip

test('round trip - the editor’s own HTML converts back to the Markdown it came from', () => {
  const body = [
    '## The five-minute test',
    '',
    'A paragraph with **bold**, _italic_, ~~a strike~~ and `inline code`.',
    '',
    '- one',
    '- two',
    '',
    '1. first',
    '2. second',
    '',
    '> A quoted sentence.',
    '',
    '---',
    '',
    '| What it shows | Meaning |',
    '| :--- | ---: |',
    '| Nothing | Hardware |',
    '',
    '```powershell',
    'Get-PnpDevice',
    '```',
    '',
    "![A worn switch](/uploads/switch.png 'Figure 1. The switch')",
  ].join('\n');

  // This is what the HTML / Source tab shows, and what it converts back from.
  assert.equal(htmlToMarkdown(renderPreview(body)).trim(), body.trim());
});

test('round trip - a heading level outside the schema’s range lands inside it', () => {
  // The body's H1 is the page title, so nothing converts back to `#`.
  assert.equal(htmlToMarkdown('<h1>Too big</h1>').trim(), '## Too big');
  assert.equal(htmlToMarkdown('<h6>Too small</h6>').trim(), `${'#'.repeat(MAX_BODY_HEADING)} Too small`);
  assert.equal(htmlToMarkdown('<h2>Just right</h2>').trim(), `${'#'.repeat(MIN_BODY_HEADING)} Just right`);
});

test('round trip - an empty paste converts to nothing rather than to blank Markdown', () => {
  assert.equal(htmlToMarkdown(''), '');
  assert.equal(htmlToMarkdown('   \n  '), '');
  assert.equal(htmlToMarkdown('<script>only a script</script>'), '');
});
