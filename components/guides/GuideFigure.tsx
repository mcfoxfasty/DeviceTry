import React from 'react';
import type { GuideImage } from '@/content/guides/schema';
import {
  GUIDE_IMAGE_SIZES,
  type GuideImageTheme,
  guideImageFallback,
  guideImageSrcSet,
  guideImageThemes,
} from '@/lib/guides/images';

interface GuideFigureProps {
  image: GuideImage;
  /**
   * True only for the article's lead figure, which sits near the top of the
   * page and is a plausible LCP element.
   *
   * This raises `fetchPriority` but deliberately does NOT set
   * `loading="eager"`. An eager image is picked up by the preload scanner
   * before the stylesheet is applied, so with two theme variants the browser
   * would download BOTH — the hidden one too — wasting a whole extra file on
   * every view. Native lazy loading is instead: an in-viewport lazy image is
   * fetched straight away at high priority, while the `display: none` variant
   * is skipped by the lazy-loading heuristic because it is not in the layout.
   */
  priority?: boolean;
  className?: string;
}

/**
 * One guide figure: a pre-rasterised WebP served through a srcset, with the
 * box reserved from the intrinsic width/height so nothing shifts when the
 * bytes land.
 *
 * A plain <img> rather than next/image on purpose, and the lint rule that
 * prefers <Image> is suppressed for this file rather than worked around.
 * next/image takes ONE `src` and generates the srcset itself — it omits
 * `srcSet` from its props entirely, so it cannot serve the three
 * pre-rasterised widths these figures already exist at. Running the bytes
 * through the optimiser as well would re-encode files that are already
 * WebP-encoded at exactly the sizes requested, and would make a statically
 * prerendered guide page depend on image-optimisation infrastructure. The
 * repo's own <Image> uses are single-size icons marked `unoptimized`, which is
 * the same reasoning.
 *
 * The width/height attributes are the CLS guard: they give the browser the
 * exact aspect ratio before the bytes arrive, so the article never reflows as
 * a figure pops in.
 */
export function GuideFigure({ image, priority = false, className = '' }: GuideFigureProps) {
  // Omitted means `diagram`: a figure is drawn artwork unless an author
  // explicitly says it is a photograph. The chip matters most once a real
  // photo heads the article — an unlabelled illustration beside a photograph
  // reads as a picture of the reader's own desk.
  const isDiagram = (image.kind ?? 'diagram') === 'diagram';
  // A photo resolves to a single, theme-agnostic file; only a diagram needs
  // a light and a dark raster.
  const themes = guideImageThemes(image.kind);

  const render = (theme: GuideImageTheme | null) => (
    // eslint-disable-next-line @next/next/no-img-element -- see the file comment: next/image cannot carry a pre-rasterised srcset.
    <img
      key={theme ?? 'single'}
      src={guideImageFallback(image.src, theme)}
      srcSet={guideImageSrcSet(image.src, theme)}
      sizes={GUIDE_IMAGE_SIZES}
      alt={image.alt}
      width={image.width}
      height={image.height}
      // Reserves the exact aspect ratio before the bytes arrive, so the
      // article never reflows as a figure pops in.
      className={`block w-full h-auto ${
        theme === 'dark' ? 'hidden dark:block' : theme === 'light' ? 'dark:hidden' : ''
      }`}
      loading="lazy"
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      draggable={false}
    />
  );

  return (
    <figure
      className={`relative my-6 overflow-hidden rounded-xl border border-[#DFE5EB] dark:border-[#223043] ${className}`}
    >
      {themes.map(render)}

      {isDiagram && (
        <span
          className="pointer-events-none absolute left-2.5 top-2.5 rounded-md bg-[#0B111A]/70 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-[2px]"
          aria-hidden="true"
        >
          Diagram
        </span>
      )}

      {image.caption && (
        <figcaption className="border-t border-[#DFE5EB] dark:border-[#223043] px-4 py-2.5 text-[11px] leading-relaxed text-[#59677D] dark:text-[#9AA6B8]">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}
