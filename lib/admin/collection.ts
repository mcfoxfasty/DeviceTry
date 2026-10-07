/**
 * The dashboard's one collection: every article in the repository, from both
 * sources, in one list.
 *
 * THE BUG THIS EXISTS TO FIX. `/admin` listed `public/guides/*.md` and nothing else.
 * The site published eighteen articles and the dashboard reported the two that
 * happen to be Markdown files — so the sixteen typed guides under
 * `content/guides/**` could not be edited, published, retired or deleted from the
 * dashboard at all, and an operator looking for one concluded it did not exist.
 *
 * WHY THE MERGE LIVES HERE AND NOT IN EITHER READER. `lib/admin/articles.ts` reads
 * the Markdown collection and `lib/admin/legacy-guides.ts` reads the module
 * collection; each knows its own format and nothing about the other. Putting the
 * union in a third module is what keeps that true — and it is also what stops a
 * circular import between the two, since the legacy reader borrows the Markdown
 * reader's base64 decoder.
 *
 * WHAT IS NOT MERGED. The statuses. A CMS article has three states in its front
 * matter; a typed module has one boolean. So a guide is `published` or `archived`
 * and can never be a `draft`, and the table says so rather than offering a state
 * the file cannot hold.
 */

import { listArticles, type ArticleSummary } from '@/lib/admin/articles';
import { readLegacyCollection } from '@/lib/admin/legacy-guides';

/** Order the table shows: newest first, and a stable answer for equal dates. */
function byNewestFirst(a: ArticleSummary, b: ArticleSummary): number {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Every article in the repository, plus any guide module that could not be read.
 *
 * `unreadable` is returned rather than swallowed: a module the legacy parser cannot
 * address is precisely the kind of article the old dashboard hid, and hiding it a
 * second way would be no improvement. The page names those paths so the fix is one
 * glance at the file.
 */
export async function readManagedCollection(options: {
  token: string;
  request?: typeof fetch;
}): Promise<{ articles: ArticleSummary[]; unreadable: string[] }> {
  const { token, request } = options;
  const cms = await listArticles({ token, request });
  const legacy = await readLegacyCollection({ token, request });

  return {
    articles: [
      ...cms,
      ...legacy.guides.map((guide) => ({
        slug: guide.slug,
        title: guide.title,
        publishedAt: guide.publishedAt,
        category: guide.category,
        status: guide.status as string,
        source: 'legacy' as const,
        repoPath: guide.repoPath,
      })),
    ].sort(byNewestFirst),
    unreadable: legacy.unreadable,
  };
}
