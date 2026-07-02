import { extractVariableKeys, getVariableDefinition, SYSTEM_KEYS } from './variable-catalogue';

/** Formate une date ISO (YYYY-MM-DD) au format long francais. */
export function formatDateFr(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const mois = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'aout', 'septembre', 'octobre', 'novembre', 'decembre',
  ];
  return `${d.getUTCDate()} ${mois[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type RenderContext = Record<string, string | number | null | undefined>;

/**
 * Substitue les jetons {{key}} d'un corps par les valeurs du contexte.
 * Une variable non fournie est remplacee par une chaine vide (jamais de {{}} orphelin).
 * Moteur pur: aucune dependance techno.
 */
export function renderTemplate(body: string, context: RenderContext): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export interface MissingVariable {
  key: string;
  label: string;
}

/**
 * Verifie que toutes les variables requises (catalogue) presentes dans le corps
 * sont fournies. Les variables systeme sont ignorees (auto-remplies).
 */
export function findMissingRequired(body: string, context: RenderContext): MissingVariable[] {
  const missing: MissingVariable[] = [];
  for (const key of extractVariableKeys(body)) {
    if (SYSTEM_KEYS.has(key)) continue;
    const def = getVariableDefinition(key);
    const provided = context[key];
    if (def?.required && (provided === undefined || provided === null || provided === '')) {
      missing.push({ key, label: def.label });
    }
  }
  return missing;
}
