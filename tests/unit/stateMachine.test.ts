import { ContractStateMachine } from '../../src/domain/contract/ContractStateMachine';
import { Contract } from '../../src/domain/contract/Contract';
import { ContractNumber } from '../../src/domain/contract/ContractNumber';
import { ContractScope, ContractStatus, RenewalMode } from '../../src/domain/enums';
import { IllegalTransitionError } from '../../src/domain/errors';

function draftContract(scope = ContractScope.PERSONNEL): Contract {
  return new Contract({
    id: '11111111-1111-1111-1111-111111111111',
    tenantSchoolId: '22222222-2222-2222-2222-222222222222',
    subjectSchoolId: scope === ContractScope.ETABLISSEMENT ? '33333333-3333-3333-3333-333333333333' : null,
    anneeScolaireId: null,
    contractNumber: ContractNumber.format(scope, 2026, 1),
    contractTypeId: '44444444-4444-4444-4444-444444444444',
    scope,
    status: ContractStatus.DRAFT,
    startDate: null,
    endDate: null,
    durationDays: null,
    trialPeriodDays: null,
    amount: null,
    currency: 'HTG',
    renewalMode: RenewalMode.MANUAL,
    ownerUserId: '55555555-5555-5555-5555-555555555555',
    title: 'Test contract',
    metadata: {},
  });
}

describe('ContractStateMachine', () => {
  it('starts in DRAFT', () => {
    expect(ContractStateMachine.initialStatus()).toBe(ContractStatus.DRAFT);
  });

  it('walks the happy path DRAFT -> ACTIVE', () => {
    const c = draftContract();
    c.transitionTo(ContractStatus.PENDING_APPROVAL);
    c.transitionTo(ContractStatus.APPROVED);
    c.transitionTo(ContractStatus.PENDING_SIGNATURE);
    c.transitionTo(ContractStatus.ACTIVE);
    expect(c.status).toBe(ContractStatus.ACTIVE);
  });

  it('allows ACTIVE -> TERMINATED -> ARCHIVED', () => {
    const c = draftContract();
    c.transitionTo(ContractStatus.PENDING_APPROVAL);
    c.transitionTo(ContractStatus.APPROVED);
    c.transitionTo(ContractStatus.PENDING_SIGNATURE);
    c.transitionTo(ContractStatus.ACTIVE);
    c.transitionTo(ContractStatus.TERMINATED);
    c.transitionTo(ContractStatus.ARCHIVED);
    expect(c.status).toBe(ContractStatus.ARCHIVED);
  });

  it('rejects an illegal transition DRAFT -> ACTIVE', () => {
    const c = draftContract();
    expect(() => c.transitionTo(ContractStatus.ACTIVE)).toThrow(IllegalTransitionError);
    expect(c.status).toBe(ContractStatus.DRAFT); // unchanged
  });

  it('rejects transitions out of a terminal state (CANCELLED)', () => {
    const c = draftContract();
    c.transitionTo(ContractStatus.CANCELLED);
    expect(ContractStateMachine.isTerminal(ContractStatus.CANCELLED)).toBe(true);
    expect(() => c.transitionTo(ContractStatus.ACTIVE)).toThrow(IllegalTransitionError);
  });

  it('enforces ETABLISSEMENT requires a subjectSchoolId', () => {
    expect(
      () =>
        new Contract({
          ...draftContract(ContractScope.ETABLISSEMENT).toJSON(),
          subjectSchoolId: null,
        }),
    ).toThrow();
  });
});
