import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ArticleEditor } from '@/components/admin/ArticleEditor';
import { isAuthenticated } from '@/lib/admin/session';
import { getPost } from '@/lib/blog/content';
import { DEFAULT_POST_STATUS, POST_CATEGORIES, POST_STATUSES, type PostStatus } from '@/keystatic.config';

/**
 * Editing an article that is already in the repository.
 *
 * The saved file — front matter, body and images — is what the editor starts
 * from, through the same reader the public pages use. Saving commits an update
 * to the same path (the contents API requires the file's current `sha`, so an
 * edit is an overwrite, never a duplicate), and if the slug was changed the old
 * file is removed after the new one lands, which is a rename rather than a copy.
 *
 * A draft or an archived article is editable here and nowhere else: the public
 * routes do not render it, by its own status.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Article — DeviceTry Admin',
};

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAuthenticated(await cookies()))) redirect('/admin/login');

  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // A file hand-edited outside the dashboard could carry a status the schema does
  // not know; it becomes the default rather than something the select cannot show.
  const status: PostStatus = POST_STATUSES.some((option) => option.value === post.status)
    ? (post.status as PostStatus)
    : DEFAULT_POST_STATUS;

  return (
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Edit article</h1>
            <p className="mt-0.5 text-sm text-[#5F6B7A] dark:text-[#9AA6B8]">
              Saving overwrites <span className="font-mono">content/posts/{post.slug}.md</span> on{' '}
              <span className="font-mono">main</span>.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-[#DFE5EB] dark:border-[#223043] bg-white dark:bg-[#131B27] px-3 py-2 text-sm font-medium hover:border-[#CBD5E1] dark:hover:border-[#31435D] transition"
          >
            ← All articles
          </Link>
        </header>

        <ArticleEditor
          categories={POST_CATEGORIES.map((category) => ({ value: category.value, label: category.label }))}
          statuses={POST_STATUSES.map((option) => ({ value: option.value, label: option.label }))}
          today={new Date().toISOString().slice(0, 10)}
          existingSlug={post.slug}
          saved={{
            title: post.title,
            slug: post.slug,
            seoTitle: post.seoTitle ?? '',
            seoDescription: post.seoDescription ?? '',
            coverImage: post.coverImage,
            coverImageAlt: post.coverImageAlt,
            publishedAt: post.publishedAt.slice(0, 10),
            author: post.author,
            category: post.category,
            status,
            tags: post.tags,
            canonicalUrl: post.canonicalUrl ?? '',
            content: post.content,
          }}
        />
      </div>
    </main>
  );
}
