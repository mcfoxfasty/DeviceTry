/**
 * Minimal, dependency-free PDF writer (PDF 1.4).
 *
 * WHY THIS EXISTS: the export flow promised a PDF but every print-based path
 * is unreliable on mobile. A pop-up window is blocked on iOS Safari; printing
 * a blob document in a hidden iframe is blocked or silently does nothing on
 * several iOS versions; and navigating the tab to a blob URL loses the test
 * result the user came to export. Those are browser policy problems no
 * amount of print() tweaking solves.
 *
 * So the app writes the PDF itself. A PDF is a plain-text container format:
 * a header, an object table, and a cross-reference table. For a text-only
 * report using one of the 14 standard fonts (Courier), no font embedding,
 * no images, and no compression are required. That makes a complete,
 * valid, multi-page PDF achievable with a few hundred bytes of string
 * building — no library, no network, no server, no navigation, and an
 * identical byte-for-byte result in every browser, phone or desktop.
 *
 * SCOPE AND LIMITS (deliberate, not accidental):
 *  - Text only, in Courier. Enough for a measurement report; not a layout
 *    engine and it does not pretend to be one.
 *  - Latin-1 text. Characters outside it are transliterated to safe ASCII
 *    equivalents so the file can never be malformed by an exotic glyph.
 *  - The file is generated in memory. It is a real PDF that opens in any
 *    PDF viewer, prints, and can be saved to Files/Files Drive.
 */

/** One line of text with its typographic role. */
export interface PdfLine {
  text: string;
  /** Visual weight. Only the two built-in weights are used. */
  style?: 'normal' | 'bold';
  /** Extra blank lines to insert after this one (section spacing). */
  spaceAfter?: number;
}

export interface PdfOptions {
  /** Document title, stored in the PDF metadata. */
  title: string;
  lines: PdfLine[];
  /** US Letter, in points. */
  pageWidth?: number;
  pageHeight?: number;
  /** Page margin in points. */
  margin?: number;
  fontSize?: number;
  /** Leading between lines, in points. */
  lineHeight?: number;
  /** Characters per line before wrapping. */
  charsPerLine?: number;
}

const DEFAULTS = {
  pageWidth: 612, // US Letter 8.5in * 72
  pageHeight: 792, // 11in * 72
  margin: 54,
  fontSize: 10,
  lineHeight: 13,
  charsPerLine: 92,
};

/**
 * Transliterate a string to the Latin-1/WinAnsi range PDF text operators
 * can represent. Anything outside that becomes an explicit, visible
 * replacement rather than a silently corrupt glyph or a broken file.
 */
export function toPdfText(input: string): string {
  const normalized = String(input ?? '')
    // Typographic characters that have clean single-codepoint Latin-1 forms.
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[·•]/g, '*')
    .replace(/[×✕]/g, 'x')
    .replace(/[→⇒]/g, '->')
    .replace(/[≈~]/g, '~')
    .replace(/[°]/g, ' deg')
    .replace(/µ/g, 'u')
    // Any remaining non-Latin-1 code point.
    .replace(/[^\x20-\x7E -ÿ]/g, '?');

  // Escape the three characters that are structural in a PDF string.
  return normalized.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Wrap one logical line to the column budget. Breaks on whitespace where it
 * can; a single unbreakable token longer than the budget is split rather
 * than allowed to run off the page.
 */
export function wrapLine(text: string, width: number): string[] {
  if (width <= 0) return [text];
  if (text.length <= width) return [text];

  const out: string[] = [];
  let rest = text;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(' ', width);
    if (cut <= 0) {
      // No usable break point: hard-split the oversized token.
      cut = width;
    }
    out.push(rest.slice(0, cut).replace(/\s+$/, ''));
    rest = rest.slice(cut).replace(/^\s+/, '');
  }
  if (rest.length > 0) out.push(rest);
  return out;
}

/** Expand the styled lines into physical (already-wrapped) lines. */
function paginate(lines: PdfLine[], charsPerLine: number): PdfLine[] {
  const physical: PdfLine[] = [];
  for (const line of lines) {
    for (const piece of wrapLine(line.text, charsPerLine)) {
      physical.push({ text: piece, style: line.style });
    }
    for (let i = 0; i < (line.spaceAfter ?? 0); i += 1) {
      physical.push({ text: '' });
    }
  }
  return physical;
}

/**
 * Build a complete PDF 1.4 document as a byte array.
 *
 * Object layout:
 *   1 catalog, 2 page tree, 3 Courier, 4 Courier-Bold,
 *   then one page object + one content stream per page.
 */
export function buildPdf(options: PdfOptions): Uint8Array {
  const pageWidth = options.pageWidth ?? DEFAULTS.pageWidth;
  const pageHeight = options.pageHeight ?? DEFAULTS.pageHeight;
  const margin = options.margin ?? DEFAULTS.margin;
  const fontSize = options.fontSize ?? DEFAULTS.fontSize;
  const lineHeight = options.lineHeight ?? DEFAULTS.lineHeight;
  const charsPerLine = options.charsPerLine ?? DEFAULTS.charsPerLine;

  const rowsPerPage = Math.max(1, Math.floor((pageHeight - margin * 2) / lineHeight));
  const rows: PdfLine[] = paginate(options.lines, charsPerLine);
  const pages: PdfLine[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    pages.push(rows.slice(i, i + rowsPerPage));
  }
  // An empty document still gets one (blank) page so the file is valid.
  if (pages.length === 0) pages.push([]);

  /** Objects, indexed by object number - 1. */
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  // Reserve 1 (catalog) and 2 (page tree) so page objects can point back.
  add(''); // 1 catalog placeholder
  add(''); // 2 page tree placeholder

  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');

  const pageIds: number[] = [];
  for (const pageRows of pages) {
    // Baseline of the first line, measured down from the top margin.
    let y = pageHeight - margin - fontSize;
    const ops: string[] = ['BT'];
    for (const row of pageRows) {
      const font = row.style === 'bold' ? '/F2' : '/F1';
      if (row.text.length > 0) {
        // 1 0 0 1 x y Tm sets the text matrix; Td is relative.
        ops.push(`${font} ${fontSize} Tf`);
        ops.push(`1 0 0 1 ${margin.toFixed(2)} ${y.toFixed(2)} Tm`);
        ops.push(`(${toPdfText(row.text)}) Tj`);
      }
      y -= lineHeight;
    }
    ops.push('ET');
    const stream = ops.join('\n');
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  const infoId = add(`<< /Title (${toPdfText(options.title)}) /Producer (DeviceTry) >>`);

  // Fill the reserved objects now that every page id is known.
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  // Serialize with a byte-accurate cross-reference table.
  const chunks: string[] = [];
  let offset = 0;
  const push = (text: string) => {
    chunks.push(text);
    offset += text.length;
  };

  push('%PDF-1.4\n');
  // A binary comment marks the file as containing binary data for tools
  // that transfer it, and is ignored by parsers.
  push('%âãÏÓ\n');

  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(offset);
    push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const value of offsets) {
    xref += `${String(value).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\n`;
  xref += `startxref\n${xrefStart}\n%%EOF\n`;
  push(xref);

  // Every character in the serialized document is Latin-1, so one char is
  // exactly one byte and string length is byte length.
  const latin1 = chunks.join('');
  const bytes = new Uint8Array(latin1.length);
  for (let i = 0; i < latin1.length; i += 1) {
    bytes[i] = latin1.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/** Turn PDF bytes into the Blob a browser can download or share. */
export function pdfBlob(bytes: Uint8Array, title: string): Blob {
  // Copy into a plain ArrayBuffer-backed view: the shared generic on
  // Uint8Array is not always assignable to BlobPart in every TS lib config.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/** A filesystem-safe PDF filename for a tool slug. */
export function pdfFilename(slug: string, observedAt: number): string {
  // Same convention as the CSV filename, plus the .pdf extension.
  const stamp = new Date(observedAt).toISOString().replace(/[:.]/g, '-');
  return `devicetry-${slug}-${stamp}.pdf`;
}

/**
 * One report's worth of text, expressed as styled lines.
 *
 * The PDF is built from the SAME data model the preview dialog shows, so the
 * file can never contain a field the user did not see or opted into —
 * including the device-label exclusion decision.
 */
export interface ReportTextModel {
  title: string;
  toolTitle: string;
  /** Preformatted section lines: bold headings and indented body text. */
  lines: PdfLine[];
}

/**
 * Build the report text model from an export data object. Kept separate from
 * the PDF byte layout so the same content can drive both the .txt fallback
 * and the .pdf, and so the privacy rules live in exactly one place.
 */
export function reportLinesFromText(text: string): ReportTextModel {
  const raw = text.split('\n');
  const lines = raw.map((entry, index) => {
    const line = entry.replace(/\s+$/, '');
    // The first line is the document title; "Key:" lines and the known
    // section names are headings. Everything else is body text.
    if (index === 0) {
      return { text: line, style: 'bold' as const };
    }
    if (/^[A-Z][A-Za-z ]+:$/.test(line) || /^(Summary|Privacy|Measurements|Test|Observed):/.test(line)) {
      return { text: line, style: 'bold' as const };
    }
    if (line.startsWith('  - ')) {
      return { text: line.slice(4), style: 'normal' as const };
    }
    if (line.startsWith('  ')) {
      return { text: line.slice(2), style: 'normal' as const };
    }
    return { text: line, style: 'normal' as const };
  });
  const title = lines[0]?.text ?? 'DeviceTry report';
  return { title, toolTitle: title, lines };
}
