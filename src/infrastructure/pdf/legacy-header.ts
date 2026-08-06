import { EDUCA_LOGO_DATA_URL } from './educa-logo';

/**
 * Remise a niveau du bandeau d'identite, avant generation du PDF.
 *
 * Jumeau de `lib/contracts/legacyHeader.ts` (console super-admin) et de
 * `features/contrats/lib/legacyHeader.ts` (console ecole). Les deux consoles
 * affichent deja le bandeau complet; sans ce module, le PDF -- le document qui
 * fait foi -- resterait le seul des trois a montrer l'ancienne presentation.
 *
 * ── Pourquoi cela ne peut pas se regler en republiant ────────────────────────
 * `updateContract` refuse toute modification hors DRAFT. Un contrat signe garde
 * donc a jamais le bandeau avec lequel il est parti.
 *
 * ── Ce qui est refait, et ce qui ne l'est JAMAIS ─────────────────────────────
 * Seul le bandeau: logo, marque, raison sociale, nom de l'etablissement,
 * filet. Du papier a en-tete -- il identifie, il ne stipule rien.
 *
 * Le TEXTE CONTRACTUEL n'est pas touche. Ni le titre, ni la reference. Et les
 * MOTS du bandeau sont relus dans le document, jamais reinventes: un contrat
 * signe sous une autre raison sociale continue de l'afficher.
 *
 * ── En cas de doute, on ne touche a rien ─────────────────────────────────────
 * Un bandeau deja moderne est laisse tel quel (ses logos et sa charte font
 * foi), et une extraction qui echoue laisse le document intact.
 */

const HEADER_BLOCK = /<header[^>]*class="[^"]*\bcontrat-entete\b[^"]*"[^>]*>[\s\S]*?<\/header>/i;
const CELL = /<td[^>]*>([\s\S]*?)<\/td>/gi;
const STRONG = /<strong[^>]*>([\s\S]*?)<\/strong>/i;
const SMALL = /<small[^>]*>([\s\S]*?)<\/small>/gi;

/** Charte du document, identique a celle des deux consoles. */
const PRIMARY = '#1B3A6B';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Texte brut d'un fragment: balises retirees, entites usuelles rendues. */
function plain(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function initial(label: string): string {
  return esc((label.trim()[0] ?? 'E').toUpperCase());
}

/**
 * Le corps publie, avec un bandeau d'identite a jour.
 *
 * Rendu inchange si le document en porte deja un moderne, ou si l'ancien n'a
 * pas pu etre relu.
 */
export function upgradeHeader(html: string): string {
  const match = HEADER_BLOCK.exec(html);
  if (!match) return html;

  // Deja a jour: le bandeau publie porte ses propres logos et sa charte, qui
  // font foi. Les remplacer reecrirait l'apparence d'un document arrete.
  if (match[0].includes('entete-vignette')) return html;

  const cells = [...match[0].matchAll(CELL)].map((m) => m[1] ?? '');
  if (cells.length < 1) return html;

  const marque = plain(STRONG.exec(cells[0])?.[1] ?? '');
  if (marque === '') return html;

  const smalls = [...cells[0].matchAll(SMALL)].map((m) => plain(m[1] ?? ''));
  const raison = smalls[0] ?? '';
  const baseline = smalls[1] ?? '';
  const schoolName = cells[1] ? plain(STRONG.exec(cells[1])?.[1] ?? '') : '';

  const school =
    schoolName !== ''
      ? `<td class="entete-texte entete-texte-ecole">
        <span class="entete-nom-ecole">${esc(schoolName)}</span>
        <span class="entete-role">Etablissement cocontractant</span>
      </td>
      <td class="entete-vignette entete-vignette-ecole"><span class="entete-initiale">${initial(
        schoolName,
      )}</span></td>`
      : '<td></td><td></td>';

  const rebuilt = `<header class="contrat-entete">
  <table class="entete-parties" style="width:100%">
    <tr>
      <td class="entete-vignette"><img class="entete-logo" src="${EDUCA_LOGO_DATA_URL}" alt="${esc(
        marque,
      )}"></td>
      <td class="entete-texte">
        <span class="entete-marque" style="color:${PRIMARY}">${esc(marque)}</span>
        <span class="entete-raison">${esc(raison)}</span>${
          baseline ? `\n        <span class="entete-baseline">${esc(baseline)}</span>` : ''
        }
      </td>
      ${school}
    </tr>
  </table>
  <span class="entete-filet" style="background-color:${PRIMARY}"></span>
</header>`;

  return html.replace(HEADER_BLOCK, rebuilt);
}
