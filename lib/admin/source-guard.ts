/**
 * The rules a saved guide module has to keep, as a pure function.
 *
 * A module is not a document: it is TypeScript in the repository, and
 * `content/guides/index.ts` imports it by name. So a paste into the source editor
 * can change what the file IS rather than what it says, and these are the four ways
 * that would break something a text field cannot fix:
 *
 *  - `slug` — the URL the article is published at. Changing it leaves the old URL
 *    404ing with nothing to explain why, and the guides registry keys off it.
 *  - the export name — `content/guides/index.ts` imports it; renaming it here means
 *    the build fails until someone edits the index by hand.
 *  - the top-level `published` flag — the management table publishes and retires a
 *    guide by flipping exactly this line, so a module without one becomes a guide
 *    the dashboard can no longer act on.
 *  - emptiness — a cleared textarea is a mistake, not a save.
 *
 * WHY THIS FILE HAS NO IMPORTS. It runs in two places: the endpoint, which is the
 * guarantee, and the editor, which shows the same messages before the author has
 * pressed Save. The editor is a client component, so anything this module imported
 * would be pulled into the browser bundle — and the obvious place to keep it
 * (`lib/admin/legacy-guides.ts`) imports the GitHub client, which imports the CMS
 * schema, which imports the whole of `@keystatic/core`. A pure function with no
 * dependencies is what lets both sides share one definition of the rules instead of
 * the browser holding a second, drifting copy.
 */

export interface SourceProblem {
  field: string;
  message: string;
}

/** What one module's source has to keep. Returns `{}` when it is saveable. */
export function sourceProblems(options: {
  source: string;
  slug: string;
  exportName: string;
}): Record<string, string> {
  const { source, slug, exportName } = options;
  const problems: Record<string, string> = {};

  if (source.trim().length === 0) {
    problems.content = 'The module is empty.';
    return problems;
  }
  if (!new RegExp(`^\\s*slug:\\s*'${slug}',?\\s*$`, 'm').test(source)) {
    problems.slug = `The module must keep declaring \`slug: '${slug}'\` — this URL is what the article is published at.`;
  }
  if (exportName.length > 0 && !new RegExp(`export const ${exportName}\\s*:\\s*GuideArticle`).test(source)) {
    problems.exportName = `The module must keep \`export const ${exportName}: GuideArticle\` — content/guides/index.ts imports that name, and the build breaks without it.`;
  }
  if (!/^\s{0,3}published:\s*(true|false)\s*,?\s*$/m.test(source)) {
    problems.published =
      'The module must keep its top-level `published: true` or `published: false` flag — the dashboard publishes and retires a guide by flipping it.';
  }
  return problems;
}
