import type { ReactNode } from 'react';
import { renderPreview } from '@/lib/admin/preview';

/**
 * The body of a CMS article that was read at REQUEST TIME, not at build time.
 *
 * WHY THIS EXISTS AT ALL. `components/blog/PostBody.tsx` renders a CMS body by
 * compiling it as MDX, and compilation is dynamic code evaluation — a compiler runs
 * the generated program. That is fine during `next build` (Node) and impossible in
 * the Cloudflare Worker, where dynamic code evaluation is banned. So an article
 * whose file did not exist when the bundle was built — the article someone published
 * a minute ago — has nothing to compile its body with. This component is what the
 * page uses for those.
 *
 * WHY THIS RENDERER AND NOT A SECOND ONE. It is the same renderer the dashboard's
 * Preview tab uses (`lib/admin/preview.ts`): it emits the constructs the editor's
 * toolbar can produce, in exactly the classes `PostBody` puts on them, and it is
 * pure string building — no compiler, no evaluation. `tests/cmsPipeline.test.ts`
 * holds the two to the same class contract, so an article cannot look like one thing
 * before a deploy and another after it.
 *
 * WHAT MAKES THE HTML SAFE. Every text run is escaped before any markup is emitted,
 * and only that file's own tags are ever produced, so a body cannot inject an
 * element the renderer did not write. Bodies are authored by the site owner through
 * the dashboard and committed through the publish endpoint, which validates them
 * first; this is the second line of defence, not the only one.
 */
export function PostBodyHtml({ content }: { content: string }): ReactNode {
  return (
    <div
      className="max-w-none"
      // Safe by construction: the renderer emits only its own tags and escapes
      // every text run; see the header comment.
      dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
    />
  );
}
