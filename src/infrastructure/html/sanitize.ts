import sanitizeHtml from 'sanitize-html';

/**
 * Assainit le HTML d'un contrat AVANT stockage (rendered_body) et rendu PDF.
 * Puppeteer execute le HTML dans Chromium: on retire donc tout vecteur d'injection
 * (<script>, gestionnaires on*, <iframe>, styles dangereux, schemes exotiques) tout
 * en conservant la mise en forme des contrats (titres, articles, listes, tableaux,
 * classes CSS comme .var-missing / .signatures). Les jetons {{...}} (texte) restent.
 */
export function sanitizeContractHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'span', 'div', 'section', 'header', 'footer', 'article',
      'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sub', 'sup', 'blockquote',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
      'img', 'a',
    ],
    allowedAttributes: {
      '*': ['class', 'style', 'id'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(bold|normal|[1-9]00)$/],
        'font-style': [/^(italic|normal)$/],
        'text-decoration': [/^(underline|none|line-through)$/],
        'font-size': [/^[\d.]+(px|em|rem|pt|%)$/],
        color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\([\d,\s]+\)$/],
        'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\([\d,\s]+\)$/],
        margin: [/^[\d.]+(px|em|rem|%)?( [\d.]+(px|em|rem|%)?){0,3}$/],
        padding: [/^[\d.]+(px|em|rem|%)?( [\d.]+(px|em|rem|%)?){0,3}$/],
        width: [/^[\d.]+(px|em|rem|%)$/],
      },
    },
    // <script>/<style>/<iframe> et gestionnaires on* sont retires (defaut + non listes).
    disallowedTagsMode: 'discard',
  });
}
