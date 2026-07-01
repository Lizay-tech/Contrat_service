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
