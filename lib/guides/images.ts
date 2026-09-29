/**
 * Responsive image contract for guide figures.
 *
 * Every figure is authored or supplied once, then rasterised to WebP at each
 * width below and stored as `<base>[-<theme>]-<width>.webp`. Pre-rasterising
 * rather than leaning on the runtime image optimiser keeps the bytes identical
 * in dev, in the preview and in the static build, and means a guide page ships
 * no server work at all for its figures.
 *
 * The theme segment exists ONLY for drawn diagrams. A diagram bakes its own
 * background and ink into the pixels, so it cannot follow the site's `.dark`
 * class; shipping a single light panel would leave a glaring rectangle on the
 * dark page. A photograph needs no such split — the same picture is correct in
 * both themes — so a photo ships one set of files and the renderer emits one
 * <img>. `GuideFigure` swaps the diagram pair with `dark:` variants, the same
 * technique components/ui/DeviceTryLogo.tsx uses for the brand lockup.
 *
 * The widths straddle the article column: `max-w-3xl` caps it at 768px on
 * desktop, and a 375px phone shows about 343px. 1152 is the 1.5x entry, which
 * is what a laptop with a scaled display actually asks for; a full 2x (1536)
 * would roughly double the bytes to resolve detail neither the flat diagrams
 * nor a compressed photograph contains.
 */
export const GUIDE_IMAGE_WIDTHS = [480, 768, 1152] as const;

export const GUIDE_IMAGE_THEMES = ['light', 'dark'] as const;
export type GuideImageTheme = (typeof GUIDE_IMAGE_THEMES)[number];

/** `sizes` for a figure sitting in the guide article column. */
export const GUIDE_IMAGE_SIZES = '(min-width: 768px) 768px, calc(100vw - 2rem)';

/** The minimum a figure's alt text must say for it to be useful. */
export const GUIDE_IMAGE_MIN_ALT = 60;

/** The file name for one width, with a theme segment only when it has one. */
export function guideImageFile(base: string, theme: GuideImageTheme | null, width: number): string {
  return theme ? `${base}-${theme}-${width}.webp` : `${base}-${width}.webp`;
}

/** The srcset for a figure. `theme` is null for a photograph. */
export function guideImageSrcSet(base: string, theme: GuideImageTheme | null): string {
  return GUIDE_IMAGE_WIDTHS.map((w) => `${guideImageFile(base, theme, w)} ${w}w`).join(', ');
}

/**
 * The `src` fallback. Deliberately the smallest entry: a browser that ignores
 * `srcset` (or a crawler that only reads `src`) then downloads the lightest
 * file rather than the heaviest.
 */
export function guideImageFallback(base: string, theme: GuideImageTheme | null): string {
  return guideImageFile(base, theme, GUIDE_IMAGE_WIDTHS[0]);
}

/**
 * The theme variants a figure needs, derived from its `kind`.
 *
 * A photo returns an empty list, so the caller renders one <img> rather than
 * two — no duplicate request, and no second copy of a photo in the
 * accessibility tree.
 */
export function guideImageThemes(kind: 'diagram' | 'photo' | undefined): Array<GuideImageTheme | null> {
  return (kind ?? 'diagram') === 'photo' ? [null] : [...GUIDE_IMAGE_THEMES];
}
