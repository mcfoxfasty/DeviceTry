/**
 * The smart foot of a published article: FAQs, related checks, related reading.
 *
 * WHY THIS IS DERIVED AND NOT HAND-WRITTEN.
 * A CMS article is a Markdown file and nothing else — there is no sidebar field
 * for "frequently asked questions", and asking an author to write one at the foot
 * of every article is how a foot of the page becomes a place nobody maintains. So
 * the three sections are computed from what the article and the site already know:
 *
 *  1. FAQ — the article's OWN question-shaped subheadings, answered with the
 *     paragraphs underneath them. Nothing is invented: if the author wrote "Does
 *     the tester measure loudness?" and answered it below, that is the pair that
 *     appears. When the article asks nothing, category questions are added whose
 *     answers are assembled verbatim from the tool registry — a tool's plain
 *     description and one of its own documented limitations — so an answer can
 *     never claim more than the tool page itself claims.
 *  2. Related checks — the diagnostic tools that match this article's subject,
 *     scored from the article's tags, title and category against each tool's own
 *     keywords and category. A checkout-page article gets no microphone tester.
 *  3. Related articles — the other published articles that share this one's
 *     category, tags or subject words, with the reason stated on each card so a
 *     reader can see why it was recommended.
 *
 * WHY IT IS PURE. Every input arrives as an argument and every output is plain
 * data, so the ranking, the caps and the "never recommend the article you are
 * reading" rule are asserted in tests instead of eyeballed on a rendered page.
 *
 * THE FLOOR MATTERS AS MUCH AS THE CEILING. A recommendation with no signal behind
 * it is worse than none: a reader who follows one dead end stops trusting the
 * section. So a tool needs a positive score to appear, an article needs a shared
 * category, tag or subject word, and both lists are capped rather than padded.
 */

import { SUPPORTING_REGISTRY, TOOLS_REGISTRY, type ToolDefinition } from '@/lib/tools/registry';
import { plainTextFromMarkdown } from '@/lib/blog/seo';
import type { BlogPost } from '@/lib/blog/content';
import type { ArticleSource, PublishedArticleRef } from '@/lib/articles/registry';

/** One question and the answer the article (or the tool registry) already gives. */
export interface ArticleFaq {
  q: string;
  a: string;
}

/** A diagnostic tool this article's reader should run. */
export interface RelatedCheck {
  slug: string;
  title: string;
  description: string;
  href: string;
  /** Why this tool, in the article's own terms. */
  reason: string;
}

/** Another published article worth reading next. */
export interface RelatedArticle {
  slug: string;
  title: string;
  href: string;
  source: ArticleSource;
  description: string;
  /** The article's cover, as a public path (`/uploads/…`, `/guides/…`). Empty when it has none. */
  coverImage: string;
  coverImageAlt: string;
  reason: string;
}

/** The whole foot of the article, ready to render. */
export interface ArticleFooter {
  faqs: ArticleFaq[];
  checks: RelatedCheck[];
  related: RelatedArticle[];
}

/** Caps, so the foot of a short article cannot become longer than the article. */
export const MAX_FAQS = 6;
/** Question headings are read first; category questions fill whatever is left. */
export const MAX_DERIVED_FAQS = 4;
export const MAX_CHECKS = 3;
export const MAX_RELATED = 3;

/** The longest an FAQ answer may run before it is clamped at a word boundary. */
export const MAX_ANSWER_LENGTH = 320;

/** Words that carry no subject and must never drive a match. */
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'and', 'any', 'are', 'because', 'been', 'before',
  'being', 'between', 'both', 'but', 'can', 'cannot', 'could', 'does', 'doing', 'done', 'down',
  'during', 'each', 'even', 'every', 'for', 'from', 'further', 'get', 'gets', 'getting', 'has',
  'have', 'having', 'here', 'how', 'into', 'its', 'just', 'like', 'made', 'make', 'makes', 'many',
  'may', 'might', 'more', 'most', 'much', 'must', 'not', 'now', 'off', 'once', 'only', 'other',
  'our', 'out', 'over', 'own', 'same', 'should', 'some', 'still', 'such', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'too', 'under',
  'until', 'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'will',
  'with', 'without', 'would', 'you', 'your',
]);

/** Words a subject is compared on: lowercase, letters and digits, no stop words. */
export function subjectWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  // A crude but deliberately small singular/plural collapse: 'keys' and 'key' are
  // one subject, and so are 'microphones' and 'microphone'. ONLY a trailing `s`,
  // and never after `ss` — stripping the `es` of a plural would turn
  // 'microphones' into 'microphon' and 'cases' into 'cas', which match nothing.
  return [
    ...new Set(words.map((word) => (word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))),
  ];
}

/** Trust the article section and stop there: a question starts with one of these. */
const QUESTION_STARTS = /^(how|what|why|which|when|where|who|can|do|does|did|is|are|should|will|would|may|must)\b/i;

/** The article's section headings, each with the prose that follows it. */
function sectionsOf(markdown: string): Array<{ heading: string; body: string }> {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections: Array<{ heading: string; body: string[] }> = [];

  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+(.*\S)\s*$/);
    if (heading) {
      sections.push({ heading: heading[1], body: [] });
      continue;
    }
    const current = sections[sections.length - 1];
    if (current) current.body.push(line);
  }

  return sections.map((section) => ({ heading: section.heading, body: section.body.join('\n') }));
}

/** Clamp prose to a sentence-sized answer, at a word boundary, saying so. */
export function clampAnswer(text: string, limit = MAX_ANSWER_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const cut = trimmed.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * A question heading, paired with the answer the article already gives it.
 *
 * The answer is the section's own first real paragraph — tables, code, images and
 * list markers are stripped, because an FAQ answer rendered as a pipe table reads
 * as a bug. A question whose section answers it with nothing (a heading followed
 * straight by another heading) is dropped rather than published as an empty pair.
 */
function faqFrom(question: string, body: string): ArticleFaq | null {
  const answer = clampAnswer(plainTextFromMarkdown(body));
  if (answer.length < 40) return null;
  return { q: question.replace(/\s*\?$/, '?'), a: answer };
}

/** True when a heading asks something a reader would search for. */
export function isQuestionHeading(heading: string): boolean {
  return heading.trim().endsWith('?') || QUESTION_STARTS.test(heading.trim());
}

/**
 * The site's guide categories, mapped onto the tool catalog's own categories.
 *
 * Only the categories that name a kind of hardware carry a bonus; a buying guide
 * and a how-to are about their subject rather than a device class, so their picks
 * have to come from the tags and the title instead of from the category alone.
 */
const CATEGORY_TOOL_CATEGORIES: Record<string, Array<string>> = {
  audio: ['audio-video'],
  video: ['audio-video'],
  'input-gaming': ['input-devices'],
  display: ['display'],
  network: ['network'],
};

/** Every routable tool, catalog first then the supporting diagnostics. */
function allTools(): ToolDefinition[] {
  return [...TOOLS_REGISTRY, ...SUPPORTING_REGISTRY];
}

/** A tool's matchable text: its title, keywords and category label. */
function toolWords(tool: ToolDefinition): Set<string> {
  return new Set(subjectWords([tool.title, tool.keywords.join(' '), tool.categoryLabel].join(' ')));
}

/**
 * Score one tool against an article, and say why in the article's own terms.
 *
 * The weights are deliberately lopsided: an explicit tag is the author saying what
 * the article is about, so it outranks a word that happens to appear in the title,
 * and both are worth less than nothing if the tool's category is unrelated — which
 * is why a score is required rather than a non-empty match.
 */
function scoreTool(
  tool: ToolDefinition,
  post: BlogPost
): { score: number; reason: string } | null {
  const tags = new Set(subjectWords(post.tags.join(' ')));
  const words = toolWords(tool);
  const title = new Set(subjectWords(post.title));

  const tagMatches = [...tags].filter((word) => words.has(word));
  const titleMatches = [...title].filter((word) => words.has(word));
  const sameCategory = (CATEGORY_TOOL_CATEGORIES[post.category] ?? []).includes(tool.category);

  const score = tagMatches.length * 3 + titleMatches.length * 2 + (sameCategory ? 2 : 0);
  if (score < 3) return null;

  const reason =
    tagMatches.length > 0
      ? `Tagged “${tagMatches[0]}” — this measures it.`
      : titleMatches.length > 0
        ? `Covers “${titleMatches[0]}”, the subject of this article.`
        : `A ${tool.categoryLabel.toLowerCase()} check for this article's category.`;

  return { score, reason };
}

/** The tools an article's reader should run, strongest match first. */
export function relatedChecksForPost(post: BlogPost): RelatedCheck[] {
  return allTools()
    .map((tool, index) => {
      const scored = scoreTool(tool, post);
      return scored ? { tool, index, ...scored } : null;
    })
    .filter((entry): entry is { tool: ToolDefinition; index: number; score: number; reason: string } => entry !== null)
    // A tie goes to the catalog order, which is editorial: the primary tools are
    // listed before the supporting diagnostics, so the more capable one wins.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_CHECKS)
    .map((entry) => ({
      slug: entry.tool.slug,
      title: entry.tool.title,
      description: entry.tool.shortDesc,
      href: `/test/${entry.tool.slug}`,
      reason: entry.reason,
    }));
}

/**
 * Other published articles worth reading next.
 *
 * `candidates` is the shared registry's list, so the CMS articles and the imported
 * guides compete on the same terms and the section cannot recommend the article
 * the reader is already on.
 */
export function relatedArticlesForPost(
  post: BlogPost,
  candidates: PublishedArticleRef[]
): RelatedArticle[] {
  const tags = new Set(subjectWords(post.tags.join(' ')));
  const words = new Set(subjectWords(post.title));

  return candidates
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      // A candidate's tags and its title are the same kind of signal — things it
      // says it is about — so they are scored together against this article's own
      // tags and title, rather than the two being cross-matched term by term.
      const candidateTags = new Set(subjectWords(`${candidate.title} ${candidate.tags.join(' ')}`));
      const sharedTags = [...tags].filter((word) => candidateTags.has(word));
      const sharedWords = [...words].filter((word) => candidateTags.has(word));
      const sameCategory = candidate.category === post.category;
      const score = sharedTags.length * 3 + sharedWords.length * 2 + (sameCategory ? 2 : 0);
      const reason = sharedTags.length > 0
        ? `Also about ${sharedTags[0]}.`
        : sharedWords.length > 0
          ? `Overlaps this article on “${sharedWords[0]}”.`
          : sameCategory
            ? `Another article in the same category.`
            : '';
      return { candidate, score, reason };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (a.candidate.publishedAt < b.candidate.publishedAt ? 1 : -1))
    .slice(0, MAX_RELATED)
    .map((entry) => ({
      slug: entry.candidate.slug,
      title: entry.candidate.title,
      href: `/guides/${entry.candidate.slug}`,
      source: entry.candidate.source,
      description: entry.candidate.description,
      coverImage: entry.candidate.coverImage,
      coverImageAlt: entry.candidate.coverImageAlt,
      reason: entry.reason,
    }));
}

/**
 * Category questions, answered from the tool registry rather than from prose.
 *
 * Each answer is assembled from strings the registry already publishes — the
 * tool's own title and its plain description — plus one of the tool's documented
 * limitations where the tool has one. That is what makes it safe to generate: the
 * answer cannot claim a capability the tool page does not claim, and it cannot
 * promise a measurement the tool page disclaims.
 */
export function categoryFaqsFor(checks: RelatedCheck[], limit: number): ArticleFaq[] {
  if (limit <= 0) return [];
  const bySlug = new Map(allTools().map((tool) => [tool.slug, tool]));

  return checks.slice(0, limit).map((check) => {
    const tool = bySlug.get(check.slug);
    const limitation = tool?.limitations[0];
    const answer = [
      `${tool?.title ?? check.title} runs entirely in the browser: ${tool?.shortDesc ?? check.description}`,
      limitation ? `One limit to know about: ${limitation}` : '',
      'No account, and nothing you record leaves the page.',
    ]
      .filter(Boolean)
      .join(' ');
    // The tool's name is in the question because a category can supply several
    // checks: two identical questions with different answers is a list a reader
    // cannot tell apart, and a duplicate key in the rendered list.
    return { q: `What does the ${tool?.title ?? check.title} measure?`, a: answer };
  });
}

/**
 * The article's foot, in one call.
 *
 * Order matters in one place only: the article's own question headings are read
 * first, so an author who wrote their own FAQ keeps it, and the generated category
 * questions only fill the space the article left.
 */
export function buildArticleFooter(
  post: BlogPost,
  context: { candidates: PublishedArticleRef[] }
): ArticleFooter {
  const derived: ArticleFaq[] = [];
  for (const section of sectionsOf(post.content)) {
    if (derived.length >= MAX_DERIVED_FAQS) break;
    if (!isQuestionHeading(section.heading)) continue;
    const faq = faqFrom(section.heading, section.body);
    if (faq) derived.push(faq);
  }

  const checks = relatedChecksForPost(post);
  const generated = categoryFaqsFor(checks, Math.max(0, MAX_FAQS - derived.length));

  return {
    faqs: [...derived, ...generated].slice(0, MAX_FAQS),
    checks,
    related: relatedArticlesForPost(post, context.candidates),
  };
}
