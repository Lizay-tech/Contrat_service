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
 *
 * ----- Parcours a deux signataires (contrats d'abonnement) -----
 * Le contrat lie EDUCA et l'etablissement : il faut deux signatures, et
 * l'ordre n'est pas impose. Les deux parcours partent de APPROVED :
 *
 *   Cas 1 (EDUCA d'abord)
 *     APPROVED -> WAITING_SIGNATURE_ADMIN -> PARTIALLY_SIGNED
 *              -> WAITING_SIGNATURE_SCHOOL -> ACTIVE
 *
 *   Cas 2 (etablissement d'abord)
 *     APPROVED -> WAITING_SIGNATURE_SCHOOL -> PARTIALLY_SIGNED
 *              -> WAITING_SIGNATURE_ADMIN -> ACTIVE
 *
 * PARTIALLY_SIGNED mene vers l'attente de l'AUTRE partie ; c'est l'appelant,
 * qui sait laquelle a deja signe, qui choisit la cible. Le domaine autorise les
 * deux et ne devine pas : deviner reviendrait a coder ici une connaissance des
 * signataires que cette couche n'a pas.
 *
 * Un refus est distinct d'une annulation : REJECTED est le fait d'une partie
 * qui refuse de signer, CANCELLED celui d'EDUCA qui retire le contrat. Les
 * confondre effacerait la raison de l'echec.
 */
const TRANSITIONS: Readonly<Record<ContractStatus, readonly ContractStatus[]>> = {
  [ContractStatus.DRAFT]: [ContractStatus.PENDING_APPROVAL, ContractStatus.CANCELLED],
  [ContractStatus.PENDING_APPROVAL]: [ContractStatus.APPROVED, ContractStatus.CANCELLED],
  [ContractStatus.APPROVED]: [
    ContractStatus.PENDING_SIGNATURE,
    // Parcours a deux signataires : l'appelant choisit qui commence.
    ContractStatus.WAITING_SIGNATURE_ADMIN,
    ContractStatus.WAITING_SIGNATURE_SCHOOL,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.PENDING_SIGNATURE]: [ContractStatus.ACTIVE],
  [ContractStatus.WAITING_SIGNATURE_ADMIN]: [
    ContractStatus.PARTIALLY_SIGNED,
    // Derniere signature attendue : le contrat devient actif directement.
    ContractStatus.ACTIVE,
    ContractStatus.REJECTED,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.WAITING_SIGNATURE_SCHOOL]: [
    ContractStatus.PARTIALLY_SIGNED,
    ContractStatus.ACTIVE,
    ContractStatus.REJECTED,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.PARTIALLY_SIGNED]: [
    ContractStatus.WAITING_SIGNATURE_ADMIN,
    ContractStatus.WAITING_SIGNATURE_SCHOOL,
    ContractStatus.REJECTED,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.REJECTED]: [
    // Un refus n'est pas definitif : le contrat repart en redaction apres
    // correction, ou est abandonne.
    ContractStatus.DRAFT,
    ContractStatus.CANCELLED,
  ],
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
