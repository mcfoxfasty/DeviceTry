import { ChevronDown, Lightbulb, Wrench, MonitorCog, HelpCircle, BookOpen } from 'lucide-react';
import { ToolDefinition } from '@/lib/tools/types';
import { getToolContent } from '@/lib/tools/content';

interface ToolSeoContentProps {
  tool: ToolDefinition;
}

const headingClass =
  'flex items-center gap-2 text-base font-bold text-[#142033] dark:text-[#E9EEF4] tracking-tight';

export function ToolSeoContent({ tool }: ToolSeoContentProps) {
  const content = getToolContent(tool);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };

  return (
    <div className="space-y-8 text-sm">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* About / why */}
      <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
        <h2 className={headingClass}>
          <BookOpen className="w-4.5 h-4.5 text-[#0F766E] dark:text-[#14B8A6]" />
          {content.aboutTitle}
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed text-[#3D4A5C] dark:text-[#AEB9C8]">
          {content.about.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="p-6 sm:p-8 rounded-2xl bg-[#E6F4F2]/60 dark:bg-[#0E2222] border border-[#0F766E]/15 dark:border-[#14B8A6]/20">
        <h2 className={headingClass}>
          <Lightbulb className="w-4.5 h-4.5 text-[#0F766E] dark:text-[#14B8A6]" />
          {content.tipsTitle}
        </h2>
        <ul className="mt-4 space-y-2.5">
          {content.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[#3D4A5C] dark:text-[#AEB9C8]">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#0F766E] dark:bg-[#14B8A6] shrink-0" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Problems & fixes */}
      <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
        <h2 className={headingClass}>
          <Wrench className="w-4.5 h-4.5 text-amber-500" />
          {content.problemsTitle}
        </h2>
        <div className="mt-4 space-y-3">
          {content.problems.map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[#FFFBEB]/60 dark:bg-[#1A1608] border border-amber-500/15 dark:border-amber-500/20"
            >
              <p className="font-semibold text-[#142033] dark:text-[#E9EEF4]">{item.problem}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#3D4A5C] dark:text-[#AEB9C8]">
                {item.fix}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* OS guides */}
      {content.osGuides && content.osGuides.length > 0 && (
        <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043]">
          <h2 className={headingClass}>
            <MonitorCog className="w-4.5 h-4.5 text-blue-500" />
            {content.osGuidesTitle}
          </h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {content.osGuides.map((guide) => (
              <div
                key={guide.os}
                className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-[#0284C7]">
                  {guide.os}
                </p>
                <ol className="mt-2.5 space-y-1.5 text-[13px] text-[#3D4A5C] dark:text-[#AEB9C8] list-decimal list-inside marker:text-[#8996A6]">
                  {guide.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ — native details/summary (crawlable, no JS needed) */}
      <section>
        <h2 className={headingClass}>
          <HelpCircle className="w-4.5 h-4.5 text-[#0F766E] dark:text-[#14B8A6]" />
          {content.faqTitle}
        </h2>
        <div className="mt-4 space-y-2.5">
          {content.faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl bg-white dark:bg-[#111D30] border border-[#DFE5EB] dark:border-[#223043] overflow-hidden open:border-[#0F766E]/40 dark:open:border-[#14B8A6]/40 transition-colors"
            >
              <summary className="flex items-center justify-between gap-4 p-4 sm:p-5 font-semibold text-[14px] text-[#142033] dark:text-[#E9EEF4] cursor-pointer select-none hover:bg-[#F6F8FB] dark:hover:bg-[#192332] transition-colors [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown className="w-4 h-4 shrink-0 text-[#8996A6] transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="px-4 sm:px-5 pb-5 text-[13px] leading-relaxed text-[#3D4A5C] dark:text-[#AEB9C8]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ToolSeoContent;
