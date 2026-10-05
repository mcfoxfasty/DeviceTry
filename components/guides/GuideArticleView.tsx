import React from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { GuideArticle } from '@/lib/guides/registry';
import type { GuideProseLink, GuideSection } from '@/content/guides/schema';
import { linksForField, splitProse } from '@/lib/guides/proseLinks';
import { findToolBySlug } from '@/lib/tools/registry';
import { getGuideBySlug } from '@/lib/guides/registry';
import { ProductBuyBox } from './ProductBuyBox';
import { GuideFigure } from './GuideFigure';
import { GuideShareRow } from '@/components/ui/GuideShareRow';
import { ScrollableTable } from '@/components/ui/ScrollableTable';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Anchor id for a section heading. Derived rather than authored so a heading
 * can be reworded without a hand-maintained list of ids quietly going stale and
 * leaving a table of contents full of dead links.
 */
function slugifyHeading(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Site-relative paths route through next/link; anything else is external. */
function isInternal(href: string): boolean {
  return href.startsWith('/');
}

/**
 * A link inside running text.
 *
 * Underlined rather than colour-only: these sit mid-sentence in body copy that
 * is already the same size and weight as everything around it, and a reader
 * scanning for the source has to be able to see the phrase is a link without
 * already knowing it is one. The underline is a low-alpha tint of the same
 * teal used by the step links, so a citation reads as part of the sentence
 * rather than as a callout bolted onto it.
 */
const PROSE_LINK_CLASS =
  'text-[#0F766E] dark:text-[#14B8A6] underline decoration-[#0F766E]/40 dark:decoration-[#14B8A6]/40 underline-offset-2 hover:decoration-[#0F766E] dark:hover:decoration-[#14B8A6] break-words [overflow-wrap:anywhere]';

/**
 * One paragraph, bullet, or step, with its declared inline links resolved.
 *
 * Sourcing is INLINE by design. A per-section "Sources" block was removed
 * because a bibliography is read once at most, and because a list at the foot
 * of a section reads as "these links cover everything above" — exactly the
 * vagueness that lets a claim drift away from its evidence. Anchoring the
 * phrase beside the claim it supports puts the check where the decision is
 * made.
 */
function Prose({
  text,
  links,
}: {
  text: string;
  links: GuideProseLink[];
}) {
  return (
    <>
      {splitProse(text, links).map((segment, i) =>
        segment.kind === 'text' ? (
          <span key={i}>{segment.value}</span>
        ) : isInternal(segment.href) ? (
          <Link key={i} href={segment.href} className={PROSE_LINK_CLASS}>
            {segment.value}
          </Link>
        ) : (
          <a
            key={i}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className={PROSE_LINK_CLASS}
          >
            {segment.value}
          </a>
        )
      )}
    </>
  );
}

/** The `proseLinks` that belong to one string of a section, by field + index. */
function fieldLinks(
  section: GuideSection,
  field: GuideProseLink['field'],
  index: number
): GuideProseLink[] {
  return linksForField(section.proseLinks, field, index);
}

/**
 * Shared article template for every guide (Phase 9, item I).
 * Renders H1 + intro, typed sections (paragraphs/bullets/steps/tables/
 * product picks), FAQs, related tool & guide links, truthful editorial
 * dates, and the affiliate disclosure ONLY when affiliate links are present.
 *
 * Figures are optional and purely additive: an article with no `featuredImage`
 * and no section `image` renders exactly as it did before, so the schema
 * change costs the other fourteen guides nothing.
 */
export function GuideArticleView({ guide }: { guide: GuideArticle }) {
  // findToolBySlug (ALL_TOOL_PAGES) rather than TOOLS_REGISTRY: six supporting
  // diagnostics live in a separate registry, so a guide linking
  // Permission Diagnostics or Codec Support silently dropped the card and
  // rendered only the other related tools.
  const relatedTools = guide.relatedToolSlugs
    .map((slug) => findToolBySlug(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const relatedGuides = (guide.relatedGuideSlugs ?? [])
    .map((slug) => getGuideBySlug(slug))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <article className="max-w-3xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider mb-3">
          <span className="px-2 py-0.5 rounded-full bg-[#E6F4F2] dark:bg-[#133230] text-[#0F766E] dark:text-[#14B8A6]">
            {guide.type === 'buying' ? 'Buying Guide' : guide.type === 'how-to' ? 'How-to' : 'Troubleshooting'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#F6F8FB] dark:bg-[#192332] text-[#59677D] dark:text-[#9AA6B8] capitalize">
            {guide.category.replace('-', ' & ')}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#142033] dark:text-[#E9EEF4] tracking-tight leading-tight">
          {guide.title}
        </h1>
        <p className="mt-3 text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed break-words">{guide.intro}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#8996A6]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Published {formatDate(guide.publishedAt)}
            {guide.updatedAt.getTime() !== guide.publishedAt.getTime() && (
              <> · Updated {formatDate(guide.updatedAt)}</>
            )}
          </span>
        </div>
        <GuideShareRow title={guide.title} slug={guide.slug} />
        {guide.hasAffiliateLinks && (
          <p className="mt-3 p-3 rounded-lg bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[11px] text-[#59677D] dark:text-[#9AA6B8]">
            Disclosure: this article contains affiliate links. If you purchase through them, we may earn a
            commission at no extra cost to you. Products are selected on specifications; we do not accept
            payment for placement.
          </p>
        )}
      </header>

      {/* Lead figure. Raised priority, but still lazily loaded: see
          GuideFigure for why an eager image would download both themes. */}
      {guide.featuredImage && <GuideFigure image={guide.featuredImage} priority />}

      {/* Linked table of contents. Opt-in per article (`showToc`), and only
          once there are enough headings for one to be worth the space. */}
      {guide.showToc && guide.sections.length >= 3 && (
        <nav
          aria-label="Table of contents"
          className="mb-8 p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8996A6] dark:text-[#677589] mb-2.5">
            On this page
          </p>
          <ol className="space-y-1.5">
            {guide.sections.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px]">
                <span className="shrink-0 tabular-nums text-[#A9B4C2] dark:text-[#5A6B82]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <a
                  href={`#${slugifyHeading(s.h2)}`}
                  className="leading-relaxed text-[#0F766E] dark:text-[#14B8A6] hover:underline break-words [overflow-wrap:anywhere]"
                >
                  {s.h2}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* An article supplied as authored markup. Rendered here — after the
          header, before the FAQs — so the H1, the intro, the editorial dates
          and the generated FAQ JSON-LD all still come from the typed fields
          and cannot drift from the page. See GuideArticle.rawBody for the
          trust boundary. */}
      {guide.rawBody && (
        <>
          {guide.rawStyle && (
            <style dangerouslySetInnerHTML={{ __html: guide.rawStyle }} />
          )}
          <div
            className="dt-guide"
            dangerouslySetInnerHTML={{ __html: guide.rawBody }}
          />
        </>
      )}

      <div className="space-y-10">
        {guide.sections.map((section, si) => (
          <section key={si}>
            {/* scroll-mt clears the sticky navbar when a table-of-contents
                anchor is followed. */}
            <h2
              id={slugifyHeading(section.h2)}
              className="text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mb-3 scroll-mt-24"
            >
              {section.h2}
            </h2>
            {/* break-words on body copy: guide text contains long unbreakable
                tokens such as chrome://settings/content/microphone, which is
                269px wide inside a 248px column on a narrow phone and forced
                the whole page to scroll horizontally. */}
            {section.paragraphs?.map((p, i) => (
              <p
                key={i}
                className="text-sm text-[#3D4A5C] dark:text-[#B7C1CE] leading-relaxed mb-3 break-words [overflow-wrap:anywhere]"
              >
                <Prose text={p} links={fieldLinks(section, 'paragraph', i)} />
              </p>
            ))}
            {/* Illustration for the steps below it. It goes AFTER the prose and
                BEFORE the list so the reader meets the picture first, and so
                the steps and bullets of a section stay contiguous. */}
            {section.image && <GuideFigure image={section.image} />}
            {section.steps && (
              <ol className="mt-3 space-y-2">
                {section.steps.map((s, i) => {
                  // A link belongs to the step that calls for it, so it lives
                  // inside that <li> rather than in the cards at the foot of
                  // the article.
                  const links = (section.stepLinks ?? []).filter((l) => l.stepIndex === i);
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-[#3D4A5C] dark:text-[#B7C1CE]"
                    >
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] text-[11px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      {/* min-w-0 lets the flex item shrink below its content;
                          break-words handles long URLs in the step text. */}
                      <span className="leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
                        <Prose text={s} links={fieldLinks(section, 'step', i)} />
                        {links.length > 0 && (
                          <span className="block mt-2">
                            {links.map((l) => (
                              <span
                                key={l.href}
                                className="block pl-3 border-l-2 border-[#0F766E]/30 dark:border-[#14B8A6]/30"
                              >
                                {isInternal(l.href) ? (
                                  <Link
                                    href={l.href}
                                    className="font-semibold text-[#0F766E] dark:text-[#14B8A6] hover:underline break-words [overflow-wrap:anywhere]"
                                  >
                                    {l.label}
                                  </Link>
                                ) : (
                                  <a
                                    href={l.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-[#0F766E] dark:text-[#14B8A6] hover:underline break-words [overflow-wrap:anywhere]"
                                  >
                                    {l.label}
                                  </a>
                                )}
                                {l.note && (
                                  <span className="block text-[11px] text-[#8996A6] dark:text-[#677589] leading-relaxed mt-0.5">
                                    {l.note}
                                  </span>
                                )}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {/* Illustration for the steps above it, so the reader meets the
                picture before working through the list it explains. */}
            {section.bullets && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-[#3D4A5C] dark:text-[#B7C1CE]">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#0F766E] dark:text-[#14B8A6] shrink-0" />
                  <span className="leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
                    <Prose text={b} links={fieldLinks(section, 'bullet', i)} />
                  </span>
                  </li>
                ))}
              </ul>
            )}
            {section.table && section.table.rows.length > 0 && (
              <ScrollableTable
                label={`Table: ${section.h2}`}
                className="mt-4"
                minWidthClass="min-w-[480px]"
              >
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F7F9] dark:bg-[#192332]">
                    <tr>
                      {section.table.columns.map((c, i) => (
                        <th key={i} className="py-2.5 px-4 font-semibold text-[#142033] dark:text-[#E9EEF4] whitespace-nowrap">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                    {section.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2 px-4 text-[#59677D] dark:text-[#9AA6B8]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            )}
            {section.table?.caption && (
              <p className="mt-1.5 px-1 text-[10px] text-[#8996A6] dark:text-[#677589]">
                {section.table.caption}
              </p>
            )}
            {section.productIds && section.productIds.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {section.productIds.map((pid) => (
                  <ProductBuyBox key={pid} productId={pid} note={section.productNotes?.[pid]} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* FAQs. The `id` is stable across every guide so an article whose own
          table of contents links to "#faq" lands here rather than nowhere.

          Skipped when the article arrives as authored markup: an imported
          article carries its own FAQ section, complete with the links from each
          answer back into the body, and rendering this block on top of it would
          print every question and answer twice. `faqs` is still declared for
          such an article — that is what the FAQPage JSON-LD is generated from,
          and those questions are genuinely on the page, inside rawBody. */}
      {guide.faqs.length > 0 && !guide.rawBody && (
        <section id="faq" className="mt-12">
          <h2 className="text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {guide.faqs.map((faq, i) => (
              <div key={i} className="p-4 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043]">
                <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4] break-words [overflow-wrap:anywhere]">{faq.q}</p>
                <p className="mt-1.5 text-sm text-[#59677D] dark:text-[#9AA6B8] leading-relaxed break-words [overflow-wrap:anywhere]">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related tools + guides */}
      {(relatedTools.length > 0 || relatedGuides.length > 0) && (
        <section className="mt-12 pt-8 border-t border-[#DFE5EB] dark:border-[#223043]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#172033] dark:text-[#E9EEF4] mb-4">
            Run the related checks
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatedTools.map((tool) => (
              <Link
                key={tool.id}
                href={`/test/${tool.slug}`}
                className="group p-4 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors"
              >
                <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] flex items-center gap-1.5">
                  {tool.title}
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </p>
                <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] mt-1">{tool.shortDesc}</p>
              </Link>
            ))}
            {relatedGuides.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group p-4 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] dark:hover:border-[#14B8A6] transition-colors"
              >
                <p className="text-xs font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] flex items-center gap-1.5">
                  Guide: {g.title}
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </p>
                <p className="text-[11px] text-[#59677D] dark:text-[#9AA6B8] mt-1 line-clamp-2">{g.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
