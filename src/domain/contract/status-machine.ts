import { ContractStatus } from '../../shared/types';

/**
 * Machine a etats du contrat - AUTORITE UNIQUE sur les transitions.
 * Domaine pur: aucune dependance techno (pas de Sequelize/Express ici).
 *
 * Transitions autorisees (cf. cahier des charges Phase 1, section 9):
 *   DRAFT -> PENDING_APPROVAL -> APPROVED -> PENDING_SIGNATURE -> ACTIVE
 *   ACTIVE -> AMENDED -> ACTIVE
 *   ACTIVE -> EXPIRING -> (RENEWED -> ACTIVE | EXPIRED)
 *   ACTIVE -> TERMINATED
 *   DRAFT | PENDING_APPROVAL | APPROVED -> CANCELLED
 *   EXPIRED | TERMINATED -> ARCHIVED
 */
const TRANSITIONS: Readonly<Record<ContractStatus, readonly ContractStatus[]>> = {
  [ContractStatus.DRAFT]: [ContractStatus.PENDING_APPROVAL, ContractStatus.CANCELLED],
  [ContractStatus.PENDING_APPROVAL]: [ContractStatus.APPROVED, ContractStatus.CANCELLED],
  [ContractStatus.APPROVED]: [ContractStatus.PENDING_SIGNATURE, ContractStatus.CANCELLED],
  [ContractStatus.PENDING_SIGNATURE]: [ContractStatus.ACTIVE],
  [ContractStatus.ACTIVE]: [
    ContractStatus.AMENDED,
    ContractStatus.EXPIRING,
    ContractStatus.TERMINATED,
  ],
  [ContractStatus.AMENDED]: [ContractStatus.ACTIVE],
  [ContractStatus.EXPIRING]: [ContractStatus.RENEWED, ContractStatus.EXPIRED],
  [ContractStatus.RENEWED]: [ContractStatus.ACTIVE],
  [ContractStatus.EXPIRED]: [ContractStatus.ARCHIVED],
  [ContractStatus.TERMINATED]: [ContractStatus.ARCHIVED],
  [ContractStatus.CANCELLED]: [],
  [ContractStatus.ARCHIVED]: [],
};

/** Statut initial de tout contrat cree. */
export const INITIAL_STATUS = ContractStatus.DRAFT;

/** Statuts terminaux (aucune transition sortante). */
export function isTerminal(status: ContractStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Transitions autorisees depuis un statut donne. */
export function allowedTransitions(from: ContractStatus): readonly ContractStatus[] {
  return TRANSITIONS[from];
}

/** Vrai si la transition from -> to est autorisee par le domaine. */
export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Valide une transition. Leve une Error (message stable) si interdite.
 * La couche application traduit cette erreur en 409 Conflict.
 */
export function assertTransition(from: ContractStatus, to: ContractStatus): void {
  if (from === to) {
    throw new InvalidTransitionError(from, to, 'Le contrat est deja dans cet etat.');
  }
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** Erreur de domaine: transition d'etat non autorisee. */
export class InvalidTransitionError extends Error {
  public readonly from: ContractStatus;
  public readonly to: ContractStatus;

  constructor(from: ContractStatus, to: ContractStatus, message?: string) {
    super(
      message ??
        `Transition non autorisee: ${from} -> ${to}. ` +
          `Transitions possibles: [${allowedTransitions(from).join(', ') || 'aucune (etat terminal)'}]`,
    );
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}
