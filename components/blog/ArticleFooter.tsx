import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, HelpCircle, Newspaper, PlayCircle } from 'lucide-react';
import type { ArticleFooter as FooterContent } from '@/lib/blog/footers';

/**
 * The generated foot of a CMS article: FAQs, related checks, related reading.
 *
 * A server component with no state, for the reason the rest of the article is one:
 * the content is already decided before the page renders — lib/blog/footers.ts
 * computes it from the article and the registries — so there is nothing here for a
 * browser to work out, and the section costs no client JavaScript.
 *
 * EACH SECTION DISAPPEARS WHEN IT IS EMPTY. An article with no question headings,
 * no matching tool and no sibling article renders exactly the article it did
 * before this existed, rather than three headings over three empty lists.
 *
 * The FAQ is a description list rather than a stack of headings, because that is
 * what it is: a term and its definition. `aria-labelledby` on each section ties it
 * to the visible heading, so a screen reader can jump between the three.
 */

function SectionHeading({ id, icon, children }: { id: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]"
    >
      {icon}
      {children}
    </h2>
  );
}

export function ArticleFooter({ content }: { content: FooterContent }) {
  const { faqs, checks, related } = content;
  if (faqs.length === 0 && checks.length === 0 && related.length === 0) return null;

  return (
    <div className="mt-12 flex flex-col gap-10 border-t border-[#DFE5EB] dark:border-[#223043] pt-8">
      {faqs.length > 0 ? (
        <section aria-labelledby="article-faq" className="scroll-mt-24">
          <SectionHeading id="article-faq" icon={<HelpCircle className="w-4 h-4" aria-hidden="true" />}>
            Frequently asked questions
          </SectionHeading>
          <dl className="mt-4 flex flex-col gap-4">
            {faqs.map((faq, index) => (
              <div
                key={`${index}-${faq.q}`}
                className="rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] px-4 py-3"
              >
                <dt className="text-sm font-semibold text-[#142033] dark:text-[#E9EEF4]">{faq.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-[#3E4C5E] dark:text-[#B8C2D0]">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {checks.length > 0 ? (
        <section aria-labelledby="article-checks" className="scroll-mt-24">
          <SectionHeading id="article-checks" icon={<PlayCircle className="w-4 h-4" aria-hidden="true" />}>
            Run the related checks
          </SectionHeading>
          <p className="mt-2 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
            These run in this browser, on this device. Nothing is uploaded and no account is needed.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {checks.map((check) => (
              <li key={check.slug}>
                <Link
                  href={check.href}
                  className="group flex h-full flex-col rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 transition-colors hover:border-[#0F766E]/60 dark:hover:border-[#14B8A6]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E]"
                >
                  <span className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6]">
                    {check.title}
                  </span>
                  <span className="mt-1.5 text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8]">
                    {check.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0F766E] dark:text-[#14B8A6]">
                    {check.reason}
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section aria-labelledby="article-related" className="scroll-mt-24">
          <SectionHeading id="article-related" icon={<Newspaper className="w-4 h-4" aria-hidden="true" />}>
            Related articles
          </SectionHeading>
          <div
            className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 scroll-mt-24"
            tabIndex={0}
            aria-label="Related articles"
          >
            {related.map((article) => (
              <Link
                key={`${article.source}-${article.slug}`}
                href={article.href}
                className="group block min-w-[280px] sm:min-w-[300px] md:min-w-[320px] flex-shrink-0 snap-start rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] p-4 transition-colors hover:border-[#0F766E]/60 dark:hover:border-[#14B8A6]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E]"
              >
                <div
                  aria-hidden={!article.coverImage}
                  className="aspect-video w-full overflow-hidden rounded-lg border border-[#E2E8F0] dark:border-[#223043] bg-[#F1F4F7] dark:bg-[#192332] mb-3"
                >
                  {article.coverImage ? (
                    <Image
                      src={article.coverImage}
                      alt={article.coverImageAlt || article.title}
                      width={1200}
                      height={630}
                      sizes="320px"
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-[#142033] dark:text-[#E9EEF4] group-hover:text-[#0F766E] dark:group-hover:text-[#14B8A6] line-clamp-2">
                    {article.title}
                  </span>
                  {article.description ? (
                    <span className="mt-1 block text-xs leading-relaxed text-[#5F6B7A] dark:text-[#9AA6B8] line-clamp-2">
                      {article.description}
                    </span>
                  ) : null}
                  <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-[#8996A6]">
                    {article.reason}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
