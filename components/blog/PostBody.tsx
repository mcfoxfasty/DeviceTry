import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';

/**
 * Renders an article body written in the CMS.
 *
 * The body is Markdown with MDX-capable syntax, so it is compiled here rather
 * than interpreted with a regex. Compilation happens during `next build` (the
 * article routes are prerendered), which is also why the Worker never runs an
 * MDX compiler at request time.
 *
 * Every element is styled explicitly instead of through a prose plugin: this
 * site's type scale and palette are defined per component elsewhere, and
 * Tailwind's typography plugin is not part of the project's stylesheet.
 *
 * The `img` override is the reason captions work at all. Markdown has nowhere to
 * put a visible caption — `![alt](src "title")` puts the title in an attribute —
 * so the renderer promotes it into a real <figcaption>, which is both what a
 * reader expects and what a screen reader announces as the image's description.
 * `alt` is never invented: an image that reaches this component without alt text
 * renders with an empty alt, and tests/blogCms.test.ts fails the build when
 * published content contains one.
 */

const headingBase = 'font-bold tracking-tight text-[#142033] dark:text-[#E9EEF4]';

const components = {
  h2: (props: ComponentPropsWithoutRef<'h2'>) => (
    <h2 className={`${headingBase} mt-10 mb-3 text-2xl scroll-mt-24`} {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<'h3'>) => (
    <h3 className={`${headingBase} mt-8 mb-2 text-xl scroll-mt-24`} {...props} />
  ),
  h4: (props: ComponentPropsWithoutRef<'h4'>) => (
    <h4 className={`${headingBase} mt-6 mb-2 text-base scroll-mt-24`} {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<'p'>) => (
    <p className="my-4 text-sm leading-relaxed text-[#3E4C5E] dark:text-[#B8C2D0]" {...props} />
  ),
  a: ({ href = '', ...props }: ComponentPropsWithoutRef<'a'>) => {
    const cls =
      'font-semibold text-[#0F766E] dark:text-[#14B8A6] underline decoration-[#0F766E]/40 underline-offset-2 hover:decoration-[#0F766E]';
    // Internal links stay in the SPA; external ones open in a new tab with the
    // same rel the rest of the site uses.
    return href.startsWith('/') || href.startsWith('#') ? (
      <Link href={href} className={cls} {...props} />
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        {...props}
      />
    );
  },
  ul: (props: ComponentPropsWithoutRef<'ul'>) => (
    <ul className="my-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[#3E4C5E] dark:text-[#B8C2D0]" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<'ol'>) => (
    <ol className="my-4 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[#3E4C5E] dark:text-[#B8C2D0]" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="pl-1" {...props} />,
  blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      className="my-6 border-l-4 border-[#0F766E]/40 bg-[#F1F4F7] dark:bg-[#192332] px-4 py-3 rounded-r-lg text-sm italic text-[#3E4C5E] dark:text-[#B8C2D0]"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<'pre'>) => (
    <pre
      className="my-5 overflow-x-auto rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#131B27] p-4 text-[12px] leading-relaxed"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<'code'>) => (
    <code
      className="rounded bg-[#F1F4F7] dark:bg-[#192332] px-1.5 py-0.5 font-mono text-[12px] text-[#142033] dark:text-[#E9EEF4]"
      {...props}
    />
  ),
  // A table scrolls on its own rather than pushing the article sideways.
  table: (props: ComponentPropsWithoutRef<'table'>) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<'th'>) => (
    <th
      className="border border-[#DFE5EB] dark:border-[#223043] bg-[#F1F4F7] dark:bg-[#192332] px-3 py-2 text-left font-semibold text-[#142033] dark:text-[#E9EEF4]"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<'td'>) => (
    <td
      className="border border-[#DFE5EB] dark:border-[#223043] px-3 py-2 align-top text-[#3E4C5E] dark:text-[#B8C2D0]"
      {...props}
    />
  ),
  hr: () => <hr className="my-8 border-t border-[#DFE5EB] dark:border-[#223043]" />,
  img: ({ src, alt, title }: ComponentPropsWithoutRef<'img'>) => (
    <figure className="my-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- CMS uploads have no
          known intrinsic size, and next/image needs one; the width/height
          attributes a CMS cannot supply would be a fabricated claim. */}
      <img
        src={typeof src === 'string' ? src : ''}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        className="w-full rounded-xl border border-[#DFE5EB] dark:border-[#223043]"
      />
      {title ? (
        <figcaption className="mt-2 text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">{title}</figcaption>
      ) : null}
    </figure>
  ),
};

export function PostBody({ content }: { content: string }): ReactNode {
  return (
    <div className="max-w-none">
      <MDXRemote
        source={content}
        components={components}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
      />
    </div>
  );
}
