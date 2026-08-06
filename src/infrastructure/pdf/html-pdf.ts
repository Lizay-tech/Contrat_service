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

/**
 * CSS des contrats, injecte systematiquement avant conversion.
 *
 * ── En-tete et titre: feuille PARTAGEE ───────────────────────────────────────
 * Les regles `.contrat-entete`, `.entete-*` et `.contrat-titre` sont le jumeau
 * de `lib/contracts/documentCss.ts` (console EDUCA) et de
 * `features/contrats/lib/documentCss.ts` (console ecole). L'assainisseur retire
 * les `<style>`: la mise en forme ne voyage pas avec le document, chaque
 * consommateur apporte la sienne. Si les trois divergent, les deux Parties
 * signent un document qui ne se presente pas de la meme facon selon l'ecran.
 * Toute modification ici doit etre reportee dans les deux autres.
 *
 * Aucune police distante ni @import: Chromium rend sans acces reseau.
 */
const CONTRACT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #2A3644; line-height: 1.6; margin: 0; }
  .contract-header { text-align: center; padding-bottom: 8px; margin-bottom: 16px; font-style: italic; color: #4b5563; }
  h1 { font-size: 18px; text-align: center; margin: 14px 0; color: #1B3A6B; }
  h2 { font-size: 13px; font-weight: 900; letter-spacing: .04em; margin: 22px 0 10px; color: #1B3A6B; }
  h3 { font-size: 12.5px; font-weight: 800; margin: 16px 0 8px; color: #2A3644; }
  p { margin: 0 0 10px; text-align: justify; }
  ul, ol { margin: 0 0 12px; padding-left: 20px; }
  li { margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 11px; }
  td, th { border: 1px solid rgba(27,58,107,.08); padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: rgba(27,58,107,.04); font-weight: 900; text-transform: uppercase; font-size: 9.5px; letter-spacing: .03em; color: #5B7BA8; }
  .var-missing { background: #FEF3C7; color: #92400E; padding: 0 3px; border-radius: 3px; font-weight: 700; }
  .contrat-article { page-break-inside: auto; }
  .contract-footer { margin-top: 24px; text-align: center; font-size: 9px; color: #6b7280; font-style: italic; }

  /* ── En-tete et titre (feuille partagee) ── */
  .contrat-entete { margin: 0 0 26px; }
  .entete-parties { width: 100%; border-collapse: collapse; margin: 0; }
  .entete-parties td { border: 0; padding: 0; vertical-align: middle; }
  .entete-vignette { width: 54px; }
  .entete-vignette-ecole { text-align: right; }
  .entete-logo { width: 46px; height: 46px; object-fit: contain; display: block; }
  .entete-vignette-ecole .entete-logo { margin-left: auto; }
  .entete-initiale { display: inline-block; width: 44px; height: 44px; line-height: 44px; text-align: center; border-radius: 12px; font-weight: 900; font-size: 17px; color: #fff; background: #1B3A6B; }
  .entete-texte { padding-left: 12px !important; }
  .entete-texte-ecole { text-align: right; padding-left: 0 !important; padding-right: 12px !important; }
  .entete-texte span { display: block; line-height: 1.25; }
  .entete-marque { font-size: 17px; font-weight: 900; letter-spacing: .02em; color: #1B3A6B; }
  .entete-raison { font-size: 10.5px; font-weight: 700; color: #5B7BA8; }
  .entete-baseline { font-size: 9.5px; color: #8BA3C7; }
  .entete-nom-ecole { font-size: 12.5px; font-weight: 900; color: #2A3644; }
  .entete-role { font-size: 9.5px; color: #8BA3C7; }
  .entete-filet { display: block; height: 2px; margin-top: 14px; background: #1B3A6B; }
  .contrat-titre { text-align: center; margin: 0 0 30px; }
  .contrat-titre h1 { font-size: 18px; font-weight: 900; line-height: 1.35; margin: 0; letter-spacing: .01em; color: #1B3A6B; }
  .contrat-reference { margin: 10px 0 0; font-size: 11px; font-weight: 600; color: #5B7BA8; text-align: center; }
  .contrat-filet { display: block; width: 64px; height: 2px; margin: 18px auto 0; background: #17A8C8; }

  /* ── Bloc de signature APPOSE ──
     Un tableau et non flex: en impression, un conteneur flex se scinde entre
     deux pages et coupe un paraphe en deux. */
  table.signatures { margin-top: 8px; page-break-inside: avoid; }
  table.signatures td.case-signature { width: 50%; border: 1px solid #C9D3E0; padding: 12px 14px; vertical-align: top; }
  .sig-titre { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: #5B7BA8; margin: 0 0 10px; }
  .sig-zone { height: 76px; border-bottom: 1px solid #C9D3E0; text-align: center; margin-bottom: 8px; position: relative; }
  .sig-zone img { max-height: 68px; max-width: 100%; object-fit: contain; position: absolute; bottom: 2px; left: 0; right: 0; margin: 0 auto; }
  .sig-zone .sig-text { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 24px; color: #1B3A6B; position: absolute; bottom: 6px; left: 0; right: 0; }
  .sig-zone .sig-attente { font-size: 9.5px; color: #8BA3C7; position: absolute; bottom: 8px; left: 0; right: 0; }
  .sig-ligne { font-size: 10px; margin: 0 0 2px; }
  .sig-ligne .sig-label { display: inline-block; width: 62px; font-weight: 700; color: #5B7BA8; }
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
  // Aucune mention "EDUCA.TECH" ajoutee ici: le corps publie porte deja son
  // propre en-tete, avec les deux Parties et leurs logos. En rajouter une
  // produisait deux identites empilees en haut de la premiere page.
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>${CONTRACT_CSS}</style></head>
<body>
${header}
${bodyHtml}
${footer}
</body></html>`;
}

/**
 * Le tableau de signature VIDE grave dans le corps publie.
 *
 * Le corps est fige au moment de la mise en signature: sa case de paraphe est
 * vide et le restera. Elle doit donc etre REMPLACEE par les signatures reelles,
 * pas doublee par une seconde section en fin de document -- ce qui donnait un
 * PDF portant une case vide puis, plus bas, les vraies signatures.
 */
const FROZEN_SIGNATURE_TABLE =
  /<table[^>]*class="[^"]*\bsignatures\b[^"]*"[^>]*>[\s\S]*?<\/table>/i;

/** Une case du bloc de signature. */
function signatureCell(title: string, sig: SignatureBlock | null): string {
  let mark = '<span class="sig-attente">En attente de signature</span>';
  if (sig) {
    if (sig.type === 'DRAWN' && sig.render) {
      mark = `<img src="${sig.render}" alt="Signature de ${escapeHtml(sig.name)}"/>`;
    } else if (sig.render) {
      mark = `<span class="sig-text">${escapeHtml(sig.render)}</span>`;
    } else {
      // Signataire signe dont le trace manque: la mention vaut mieux que le
      // silence, qui laisserait croire qu'il n'a pas signe.
      mark = `<span class="sig-text">${escapeHtml(sig.name)}</span>`;
    }
  }

  const row = (label: string, value: string): string =>
    `<p class="sig-ligne"><span class="sig-label">${label}</span>${escapeHtml(value) || '—'}</p>`;

  return `<td class="case-signature">
      <p class="sig-titre">${escapeHtml(title)}</p>
      <div class="sig-zone">${mark}</div>
      ${row('Nom', sig?.name ?? '')}
      ${row('Courriel', sig?.role ?? '')}
      ${row('Date', sig?.date ?? '')}
    </td>`;
}

/**
 * Bloc de signature des deux Parties.
 *
 * L'attribution se fait par le RANG, jamais par le nom: la console cree
 * invariablement EDUCA au rang 0 et l'etablissement aux rangs suivants.
 * Reconnaitre EDUCA a son nom echouerait des qu'un representant signe sous son
 * propre patronyme, ce qui est le cas normal.
 */
function signaturesHtml(signatures: Array<SignatureBlock | null>): string {
  if (!signatures.length) return '';
  return `<table class="signatures" style="width:100%">
  <tr>
    ${signatureCell('Pour EDUCA', signatures[0] ?? null)}
    ${signatureCell("Pour l'Etablissement", signatures[1] ?? null)}
  </tr>
</table>`;
}

/**
 * Substitue les signatures reelles a la case figee du corps.
 *
 * Si le corps ne porte aucune case (document venu d'ailleurs), le bloc est
 * ajoute a la fin plutot que perdu.
 */
function withSignatures(body: string, signatures: Array<SignatureBlock | null>): string {
  const block = signaturesHtml(signatures);
  if (!block) return body;
  return FROZEN_SIGNATURE_TABLE.test(body)
    ? body.replace(FROZEN_SIGNATURE_TABLE, block)
    : `${body}\n${block}`;
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

/**
 * Genere le PDF SIGNE: corps + signatures apposees, EN LIEU ET PLACE de la
 * case vide gravee dans le corps publie.
 *
 * `signatures` est indexe par RANG: l'element 0 est la Partie EDUCA, le 1
 * l'etablissement. Une case sans signataire signe recoit `null` et s'affiche
 * "En attente de signature" -- un contrat a moitie signe ne doit pas en avoir
 * l'air, ni l'inverse.
 */
export function htmlToPdfWithSignatures(
  body: string,
  options: HtmlPdfOptions,
  signatures: Array<SignatureBlock | null>,
): Promise<Buffer> {
  return renderToPdf(wrapDocument(withSignatures(body, signatures), options));
}
