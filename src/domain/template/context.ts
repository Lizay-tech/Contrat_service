import { amountInWords } from './number-to-words';
import { formatDateFr } from './render';
import type { RenderContext } from './render';

const DATE_KEYS = new Set(['start_date', 'end_date', 'employee_birth_date', 'signature_date']);

export interface ContextOptions {
  contractNumber?: string | null;
  contractType?: string | null;
  contractTitle?: string | null;
  amount?: number | null;
  currency?: string | null;
  academicYear?: string | null;
  city?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}

/**
 * Fabrique le contexte de rendu final a partir des variables fournies + des
 * valeurs derivees/systeme. Formate les dates en francais et calcule
 * salary_in_words si absent. Domaine pur.
 */
export function assembleRenderContext(
  rawVariables: Record<string, unknown>,
  options: ContextOptions = {},
): RenderContext {
  const ctx: RenderContext = {};

  // Copie + formatage des variables fournies.
  for (const [key, value] of Object.entries(rawVariables)) {
    if (value === null || value === undefined) continue;
    ctx[key] = DATE_KEYS.has(key) ? formatDateFr(String(value)) : (value as string | number);
  }

  // Valeurs derivees du contrat.
  if (options.startDate != null && ctx.start_date === undefined) {
    ctx.start_date = formatDateFr(options.startDate);
  }
  if (options.endDate != null && ctx.end_date === undefined) {
    ctx.end_date = formatDateFr(options.endDate);
  }
  if (options.contractNumber != null) ctx.contract_number = options.contractNumber;
  if (options.contractType != null) ctx.contract_type = options.contractType;
  if (options.contractTitle != null) ctx.contract_title = options.contractTitle;
  if (options.academicYear != null) ctx.academic_year = options.academicYear;
  if (options.currency != null && ctx.currency === undefined) ctx.currency = options.currency;

  if (options.amount != null) {
    if (ctx.salary === undefined) ctx.salary = options.amount;
    if (ctx.salary_in_words === undefined) {
      ctx.salary_in_words = amountInWords(options.amount, options.currency ?? 'HTG');
    }
  }

  // Variables systeme (auto-remplies).
  const now = options.now ?? new Date();
  if (ctx.today === undefined) ctx.today = formatDateFr(now);
  if (ctx.city === undefined) ctx.city = options.city ?? '';
  if (ctx.signature_zone === undefined) ctx.signature_zone = '_______________________';
  if (ctx.page_number === undefined) ctx.page_number = '';

  return ctx;
}
