import {
  allowedTransitions,
  assertTransition,
  canTransition,
  INITIAL_STATUS,
  InvalidTransitionError,
  isTerminal,
} from '../src/domain/contract/status-machine';
import { ContractStatus } from '../src/shared/types';

/** Tests unitaires purs de la machine a etats (aucune dependance techno). */
describe('Machine a etats du contrat', () => {
  it('demarre en DRAFT', () => {
    expect(INITIAL_STATUS).toBe(ContractStatus.DRAFT);
  });

  it('autorise le chemin nominal DRAFT -> ACTIVE', () => {
    const path = [
      ContractStatus.DRAFT,
      ContractStatus.PENDING_APPROVAL,
      ContractStatus.APPROVED,
      ContractStatus.PENDING_SIGNATURE,
      ContractStatus.ACTIVE,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('refuse une transition directe DRAFT -> ACTIVE', () => {
    expect(canTransition(ContractStatus.DRAFT, ContractStatus.ACTIVE)).toBe(false);
    expect(() => assertTransition(ContractStatus.DRAFT, ContractStatus.ACTIVE)).toThrow(
      InvalidTransitionError,
    );
  });

  it('refuse une transition depuis un etat terminal', () => {
    expect(isTerminal(ContractStatus.ARCHIVED)).toBe(true);
    expect(isTerminal(ContractStatus.CANCELLED)).toBe(true);
    expect(allowedTransitions(ContractStatus.ARCHIVED)).toHaveLength(0);
  });

  it('gere le cycle de renouvellement ACTIVE -> EXPIRING -> RENEWED -> ACTIVE', () => {
    expect(canTransition(ContractStatus.ACTIVE, ContractStatus.EXPIRING)).toBe(true);
    expect(canTransition(ContractStatus.EXPIRING, ContractStatus.RENEWED)).toBe(true);
    expect(canTransition(ContractStatus.RENEWED, ContractStatus.ACTIVE)).toBe(true);
    expect(canTransition(ContractStatus.EXPIRING, ContractStatus.EXPIRED)).toBe(true);
  });

  it('refuse une transition vers le meme etat', () => {
    expect(() => assertTransition(ContractStatus.ACTIVE, ContractStatus.ACTIVE)).toThrow();
  });
});

/**
 * Contrats d'abonnement : deux signatures, dans l'ordre que l'on veut.
 * Ces tests fixent les DEUX parcours du cahier des charges pour qu'aucun des
 * deux ne puisse etre casse par une modification ulterieure de la table.
 */
describe('Parcours a deux signataires (abonnement etablissement)', () => {
  it('autorise le cas 1 : EDUCA signe en premier', () => {
    const path = [
      ContractStatus.APPROVED,
      ContractStatus.WAITING_SIGNATURE_ADMIN,
      ContractStatus.PARTIALLY_SIGNED,
      ContractStatus.WAITING_SIGNATURE_SCHOOL,
      ContractStatus.ACTIVE,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('autorise le cas 2 : l’etablissement signe en premier', () => {
    const path = [
      ContractStatus.APPROVED,
      ContractStatus.WAITING_SIGNATURE_SCHOOL,
      ContractStatus.PARTIALLY_SIGNED,
      ContractStatus.WAITING_SIGNATURE_ADMIN,
      ContractStatus.ACTIVE,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('permet de conclure directement quand la derniere signature tombe', () => {
    // Une seule partie restait attendue : le contrat devient actif sans repasser
    // par PARTIALLY_SIGNED, qui ne decrirait plus la realite.
    expect(canTransition(ContractStatus.WAITING_SIGNATURE_ADMIN, ContractStatus.ACTIVE)).toBe(true);
    expect(canTransition(ContractStatus.WAITING_SIGNATURE_SCHOOL, ContractStatus.ACTIVE)).toBe(true);
  });

  it('refuse de sauter la signature : APPROVED -> ACTIVE reste interdit', () => {
    expect(canTransition(ContractStatus.APPROVED, ContractStatus.ACTIVE)).toBe(false);
  });

  it('refuse d’activer un contrat partiellement signe', () => {
    // PARTIALLY_SIGNED signifie qu'il MANQUE une signature : y autoriser ACTIVE
    // rendrait l'etat decoratif.
    expect(canTransition(ContractStatus.PARTIALLY_SIGNED, ContractStatus.ACTIVE)).toBe(false);
    expect(() =>
      assertTransition(ContractStatus.PARTIALLY_SIGNED, ContractStatus.ACTIVE),
    ).toThrow(InvalidTransitionError);
  });

  it('distingue le refus d’une partie de l’annulation par EDUCA', () => {
    expect(canTransition(ContractStatus.WAITING_SIGNATURE_SCHOOL, ContractStatus.REJECTED)).toBe(true);
    expect(canTransition(ContractStatus.WAITING_SIGNATURE_SCHOOL, ContractStatus.CANCELLED)).toBe(true);
    // Un refus n'est pas terminal : on corrige et on repart en redaction.
    expect(isTerminal(ContractStatus.REJECTED)).toBe(false);
    expect(canTransition(ContractStatus.REJECTED, ContractStatus.DRAFT)).toBe(true);
  });

  it('n’ouvre aucune transition depuis les etats de signature vers un etat de fin de vie', () => {
    // EXPIRED/TERMINATED/ARCHIVED n'ont de sens qu'apres ACTIVE : un contrat
    // jamais signe ne peut pas expirer.
    for (const from of [
      ContractStatus.WAITING_SIGNATURE_ADMIN,
      ContractStatus.WAITING_SIGNATURE_SCHOOL,
      ContractStatus.PARTIALLY_SIGNED,
    ]) {
      expect(canTransition(from, ContractStatus.EXPIRED)).toBe(false);
      expect(canTransition(from, ContractStatus.TERMINATED)).toBe(false);
      expect(canTransition(from, ContractStatus.ARCHIVED)).toBe(false);
    }
  });
});
