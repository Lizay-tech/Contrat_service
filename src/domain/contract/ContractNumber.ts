import { ContractScope } from '../enums';

/**
 * Value object encapsulating the contract-number format. The numeric sequence
 * is supplied by the persistence layer (unique per tenant); the domain only
 * owns the formatting rule so it stays consistent everywhere.
 *
 * Format: EDUCA-<SCOPE_PREFIX>-<YEAR>-<SEQ padded to 5>
 *   e.g. EDUCA-PER-2026-00042  /  EDUCA-ETB-2026-00007
 */
export const ContractNumber = {
  prefixFor(scope: ContractScope): string {
    return scope === ContractScope.ETABLISSEMENT ? 'ETB' : 'PER';
  },

  format(scope: ContractScope, year: number, sequence: number): string {
    const seq = String(sequence).padStart(5, '0');
    return `EDUCA-${this.prefixFor(scope)}-${year}-${seq}`;
  },
} as const;
