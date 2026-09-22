import React from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { GuideArticle } from '@/lib/guides/registry';
import { TOOLS_REGISTRY } from '@/lib/tools/registry';
import { getGuideBySlug } from '@/lib/guides/registry';
import { ProductBuyBox } from './ProductBuyBox';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Shared article template for every guide (Phase 9, item I).
 * Renders H1 + intro, typed sections (paragraphs/bullets/steps/tables/
 * product picks), FAQs, related tool & guide links, truthful editorial
 * dates, and the affiliate disclosure ONLY when affiliate links are present.
 */
export function GuideArticleView({ guide }: { guide: GuideArticle }) {
  const relatedTools = guide.relatedToolSlugs
    .map((slug) => TOOLS_REGISTRY.find((t) => t.slug === slug))
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
        <p className="mt-3 text-sm text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">{guide.intro}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#8996A6]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Published {formatDate(guide.publishedAt)}
            {guide.updatedAt.getTime() !== guide.publishedAt.getTime() && (
              <> · Updated {formatDate(guide.updatedAt)}</>
            )}
          </span>
        </div>
        {guide.hasAffiliateLinks && (
          <p className="mt-3 p-3 rounded-lg bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] text-[11px] text-[#59677D] dark:text-[#9AA6B8]">
            Disclosure: this article contains affiliate links. If you purchase through them, we may earn a
            commission at no extra cost to you. Products are selected on specifications; we do not accept
            payment for placement.
          </p>
        )}
      </header>

      <div className="space-y-10">
        {guide.sections.map((section, si) => (
          <section key={si}>
            <h2 className="text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mb-3">{section.h2}</h2>
            {section.paragraphs?.map((p, i) => (
              <p key={i} className="text-sm text-[#3D4A5C] dark:text-[#B7C1CE] leading-relaxed mb-3">
                {p}
              </p>
            ))}
            {section.steps && (
              <ol className="mt-3 space-y-2">
                {section.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#3D4A5C] dark:text-[#B7C1CE]">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#0F766E]/10 text-[#0F766E] dark:text-[#14B8A6] text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            )}
            {section.bullets && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#3D4A5C] dark:text-[#B7C1CE]">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#0F766E] dark:text-[#14B8A6] shrink-0" />
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.table && section.table.rows.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-[#DFE5EB] dark:border-[#223043]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F7F9] dark:bg-[#192332]">
                    <tr>
                      {section.table.columns.map((c, i) => (
                        <th key={i} className="py-2.5 px-4 font-semibold text-[#142033] dark:text-[#E9EEF4]">
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
                {section.table.caption && (
                  <p className="px-4 py-2 text-[10px] text-[#8996A6] bg-[#F6F7F9] dark:bg-[#192332]">
                    {section.table.caption}
                  </p>
                )}
              </div>
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

      {/* FAQs */}
      {guide.faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-[#142033] dark:text-[#E9EEF4] mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {guide.faqs.map((faq, i) => (
              <div key={i} className="p-4 rounded-xl bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043]">
                <p className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">{faq.q}</p>
                <p className="mt-1.5 text-sm text-[#59677D] dark:text-[#9AA6B8] leading-relaxed">{faq.a}</p>
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
