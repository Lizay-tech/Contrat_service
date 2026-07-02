import puppeteer, { type Browser } from 'puppeteer';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';

/**
 * Generation PDF via Puppeteer (Chromium headless) - rendu HTML+CSS FIDELE.
 *
 * Le corps rendu (le meme que le preview format:"html") est enveloppe dans un
 * document HTML complet avec le CSS des contrats, puis converti en PDF. Les
 * <img> (signatures DRAWN en data URL) sont supportes nativement.
 *
 * Une instance de navigateur est reutilisee (singleton) pour eviter de relancer
 * Chromium a chaque appel; chaque page est fermee proprement apres usage.
 */
export interface HtmlPdfOptions {
  title?: string;
  header?: string | null;
  footer?: string | null;
}

export interface SignatureBlock {
  name: string;
  role?: string | null;
  date: string;
  type: 'TEXT' | 'DRAWN';
  /** data URL (image DRAWN) ou texte stylise (TEXT). */
  render?: string | null;
}

/** CSS des contrats, injecte systematiquement avant conversion. */
const CONTRACT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #1f2937; line-height: 1.55; margin: 0; }
  .contract-brand { text-align: right; font-size: 11px; color: #6b7280; }
  .contract-header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 16px; font-style: italic; color: #4b5563; }
  h1 { font-size: 20px; text-align: center; margin: 14px 0; }
  h2 { font-size: 15px; margin: 18px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
  h3 { font-size: 13px; margin: 14px 0 4px; color: #111827; }
  p { margin: 6px 0; text-align: justify; }
  ul { margin: 6px 0 6px 18px; padding: 0; }
  li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td, th { padding: 4px 6px; vertical-align: top; }
  .var-missing { background: #FEF3C7; color: #92400E; padding: 0 2px; border-radius: 2px; }
  .signatures { margin-top: 28px; display: flex; flex-wrap: wrap; gap: 24px; }
  .sign-zone { flex: 1 1 40%; min-width: 220px; border-top: 1px solid #9ca3af; padding-top: 6px; margin-top: 36px; }
  .sign-zone .sig-name { font-weight: bold; }
  .sign-zone .sig-role { font-size: 10px; color: #6b7280; }
  .sign-zone .sig-text { font-family: 'Segoe Script', cursive; font-size: 22px; }
  .sign-zone img { max-height: 60px; max-width: 200px; }
  .sign-zone .sig-date { font-size: 10px; color: #6b7280; margin-top: 4px; }
  .contract-footer { margin-top: 24px; text-align: center; font-size: 9px; color: #6b7280; font-style: italic; }
`;

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    browserPromise = puppeteer.launch({
      headless: true,
      ...(execPath ? { executablePath: execPath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
}

/** Ferme le navigateur (appele au shutdown du service). */
export async function closePdfBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch (err) {
      logger.warn({ err }, '[pdf] fermeture navigateur');
    }
    browserPromise = null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapDocument(bodyHtml: string, options: HtmlPdfOptions): string {
  const header = options.header
    ? `<div class="contract-header">${options.header}</div>`
    : '';
  const footer = options.footer
    ? `<div class="contract-footer">${options.footer}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>${CONTRACT_CSS}</style></head>
<body>
<div class="contract-brand">EDUCA.TECH</div>
${header}
${bodyHtml}
${footer}
</body></html>`;
}

function signaturesHtml(signatures: SignatureBlock[]): string {
  if (!signatures.length) return '';
  const zones = signatures
    .map((sig) => {
      let sig_render = '';
      if (sig.type === 'DRAWN' && sig.render) {
        sig_render = `<img src="${sig.render}" alt="signature"/>`;
      } else if (sig.render) {
        sig_render = `<div class="sig-text">${escapeHtml(sig.render)}</div>`;
      }
      const role = sig.role ? `<div class="sig-role">${escapeHtml(sig.role)}</div>` : '';
      return `<div class="sign-zone">
        <div class="sig-name">${escapeHtml(sig.name)}</div>
        ${role}
        ${sig_render}
        <div class="sig-date">Signe le ${escapeHtml(sig.date)}</div>
      </div>`;
    })
    .join('');
  return `<h2>Signatures</h2><div class="signatures">${zones}</div>`;
}

async function renderToPdf(fullHtml: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // HTML autonome (CSS inline, images en data URL) -> 'load' attend le rendu
    // complet (images comprises) sans dependre du reseau (bloque de toute facon).
    await page.setContent(fullHtml, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '16mm', right: '16mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** Genere un PDF a partir d'un corps HTML rendu (variables deja substituees). */
export function htmlToPdf(body: string, options: HtmlPdfOptions = {}): Promise<Buffer> {
  return renderToPdf(wrapDocument(body, options));
}

/** Genere le PDF SIGNE: corps + section "Signatures" (images/texte apposes). */
export function htmlToPdfWithSignatures(
  body: string,
  options: HtmlPdfOptions,
  signatures: SignatureBlock[],
): Promise<Buffer> {
  return renderToPdf(wrapDocument(`${body}${signaturesHtml(signatures)}`, options));
}
