import PDFDocument from 'pdfkit';

/**
 * Rendu PDF d'un corps HTML RESTREINT (sous-ensemble volontairement limite).
 *
 * Choix pdfkit (vs puppeteer): pas de Chromium headless embarque (~300 Mo),
 * image Docker legere, rendu deterministe. Les templates de contrat utilisent
 * un HTML contraint : <h1>-<h3>, <p>, <br>, <strong>/<b>, <em>/<i>, <ul>/<li>,
 * <table>/<tr>/<td> (rendus en blocs simples). Un HTML/CSS arbitraire n'est pas
 * un objectif de ce module (ce serait le cas d'usage de puppeteer).
 */
export interface HtmlPdfOptions {
  title?: string;
  header?: string | null;
  footer?: string | null;
}

interface Segment {
  text: string;
  bold: boolean;
  italic: boolean;
}

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li';
  segments: Segment[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

/** Decoupe le contenu inline d'un bloc en segments (gras/italique). */
function parseInline(html: string): Segment[] {
  const segments: Segment[] = [];
  let bold = false;
  let italic = false;
  const re = /<\/?(strong|b|em|i)\s*>|<br\s*\/?\s*>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1]?.toLowerCase();
    const text = m[2];
    if (tag) {
      const closing = m[0].startsWith('</');
      if (tag === 'b' || tag === 'strong') bold = !closing;
      else if (tag === 'i' || tag === 'em') italic = !closing;
    } else if (m[0].toLowerCase().startsWith('<br')) {
      segments.push({ text: '\n', bold, italic });
    } else if (text) {
      const clean = decodeEntities(text).replace(/\s+/g, ' ');
      if (clean) segments.push({ text: clean, bold, italic });
    }
  }
  return segments;
}

/** Transforme le HTML restreint en une liste de blocs ordonnes. */
function parseBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  // Deroule les cellules de tableau en blocs paragraphe (mise en page simple).
  const normalized = html
    .replace(/<\/(td|th)>/gi, '<br/>')
    .replace(/<\/tr>/gi, '')
    .replace(/<(table|tbody|thead|tr|td|th)[^>]*>/gi, '')
    .replace(/<\/(ul|ol)>/gi, '');

  const re = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>|<li[^>]*>([\s\S]*?)(?=<li|<\/ul|$)/gi;
  let m: RegExpExecArray | null;
  let matchedAny = false;
  while ((m = re.exec(normalized)) !== null) {
    matchedAny = true;
    const tag = (m[1] ?? 'li').toLowerCase() as Block['type'];
    const inner = m[2] ?? m[3] ?? '';
    blocks.push({ type: tag, segments: parseInline(inner) });
  }

  // Repli: si aucun bloc structure, traiter tout le texte comme un paragraphe.
  if (!matchedAny) {
    const stripped = normalized.replace(/<[^>]+>/g, ' ');
    blocks.push({ type: 'p', segments: parseInline(stripped) });
  }
  return blocks;
}

function writeBlock(doc: PDFKit.PDFDocument, block: Block): void {
  const sizes: Record<Block['type'], number> = { h1: 18, h2: 15, h3: 13, p: 11, li: 11 };
  const size = sizes[block.type];
  doc.moveDown(0.4);

  if (block.type === 'li') {
    doc.font('Helvetica').fontSize(size).text('•  ', { continued: true });
  }

  let first = true;
  for (const seg of block.segments) {
    const isHeading = block.type.startsWith('h');
    const font =
      (seg.bold || isHeading) && seg.italic
        ? 'Helvetica-BoldOblique'
        : seg.bold || isHeading
          ? 'Helvetica-Bold'
          : seg.italic
            ? 'Helvetica-Oblique'
            : 'Helvetica';
    const parts = seg.text.split('\n');
    parts.forEach((part, idx) => {
      if (part) {
        doc.font(font).fontSize(size).text(part, { continued: true });
      }
      if (idx < parts.length - 1) doc.text('\n', { continued: false });
      first = false;
    });
  }
  if (!first) doc.text('', { continued: false });
}

/** Bloc de signature appose sur le PDF signe. */
export interface SignatureBlock {
  name: string;
  role?: string | null;
  date: string;
  type: 'TEXT' | 'DRAWN';
  /** data URL (image DRAWN) ou texte stylise (TEXT). */
  render?: string | null;
}

function renderPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

function writeBody(doc: PDFKit.PDFDocument, body: string, options: HtmlPdfOptions): void {
  if (options.header) {
    doc.font('Helvetica-Oblique').fontSize(9).text(decodeEntities(stripTags(options.header)), {
      align: 'center',
    });
    doc.moveDown(0.5);
  }
  for (const block of parseBlocks(body)) writeBlock(doc, block);
  if (options.footer) {
    doc.moveDown(1);
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(decodeEntities(stripTags(options.footer)), { align: 'center' });
  }
}

/** Genere un PDF (Buffer) a partir d'un corps HTML restreint deja rendu. */
export function htmlToPdf(body: string, options: HtmlPdfOptions = {}): Promise<Buffer> {
  return renderPdf((doc) => writeBody(doc, body, options));
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = /^data:[^;]+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return Buffer.from(match[1] as string, 'base64');
  } catch {
    return null;
  }
}

/**
 * Genere le PDF SIGNE: le corps rendu suivi d'une section "Signatures" ou chaque
 * signataire est appose (image DRAWN embarquee, ou texte stylise TEXT) avec nom,
 * role et date.
 */
export function htmlToPdfWithSignatures(
  body: string,
  options: HtmlPdfOptions,
  signatures: SignatureBlock[],
): Promise<Buffer> {
  return renderPdf((doc) => {
    writeBody(doc, body, options);

    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(14).text('Signatures');
    doc.moveDown(0.5);

    for (const sig of signatures) {
      doc.font('Helvetica-Bold').fontSize(11).text(sig.name);
      if (sig.role) doc.font('Helvetica').fontSize(9).text(sig.role);

      if (sig.type === 'DRAWN' && sig.render) {
        const buf = dataUrlToBuffer(sig.render);
        if (buf) {
          try {
            doc.image(buf, { fit: [180, 60] });
          } catch {
            doc.font('Helvetica-Oblique').fontSize(10).text('[signature]');
          }
        }
      } else if (sig.render) {
        // Signature texte stylisee (police cursive non embarquee -> italique).
        doc.font('Helvetica-Oblique').fontSize(20).text(sig.render);
      }

      doc.font('Helvetica').fontSize(9).text(`Signe le ${sig.date}`);
      doc.moveDown(1);
    }
  });
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
