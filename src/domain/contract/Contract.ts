import {
  ContractScope,
  ContractStatus,
  RenewalMode,
} from '../enums';
import { ContractInvariantError } from '../errors';
import { ContractStateMachine } from './ContractStateMachine';

export interface ContractProps {
  id: string;
  tenantSchoolId: string;
  subjectSchoolId: string | null;
  anneeScolaireId: string | null;
  contractNumber: string;
  contractTypeId: string;
  scope: ContractScope;
  status: ContractStatus;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  trialPeriodDays: number | null;
  amount: string | null; // decimal kept as string to avoid float drift
  currency: string;
  renewalMode: RenewalMode;
  ownerUserId: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Pure domain entity. Holds contract state and enforces invariants. It knows
 * nothing about Sequelize, Express, or persistence. The state machine is the
 * sole authority for status transitions.
 */
export class Contract {
  private props: ContractProps;

  constructor(props: ContractProps) {
    this.props = props;
    this.validateInvariants();
  }

  private validateInvariants(): void {
    if (!this.props.title || this.props.title.trim().length === 0) {
      throw new ContractInvariantError('Contract title is required');
    }
    if (
      this.props.scope === ContractScope.ETABLISSEMENT &&
      !this.props.subjectSchoolId
    ) {
      throw new ContractInvariantError(
        'ETABLISSEMENT contracts require a subjectSchoolId',
      );
    }
    if (
      this.props.scope === ContractScope.PERSONNEL &&
      this.props.subjectSchoolId
    ) {
      throw new ContractInvariantError(
        'PERSONNEL contracts must not carry a subjectSchoolId',
      );
    }
    if (this.props.startDate && this.props.endDate) {
      if (this.props.endDate.getTime() < this.props.startDate.getTime()) {
        throw new ContractInvariantError('endDate cannot be before startDate');
      }
    }
  }

  // --- getters (read-only view) ---
  get id(): string {
    return this.props.id;
  }
  get tenantSchoolId(): string {
    return this.props.tenantSchoolId;
  }
  get subjectSchoolId(): string | null {
    return this.props.subjectSchoolId;
  }
  get scope(): ContractScope {
    return this.props.scope;
  }
  get status(): ContractStatus {
    return this.props.status;
  }
  get contractNumber(): string {
    return this.props.contractNumber;
  }
  get title(): string {
    return this.props.title;
  }

  toJSON(): ContractProps {
    return { ...this.props };
  }

  /** True when the contract is still editable (only in DRAFT). */
  isEditable(): boolean {
    return this.props.status === ContractStatus.DRAFT;
  }

  /**
   * Applies a status transition through the state machine. Mutates the entity
   * in-memory only; persistence is the caller's responsibility. Returns the
   * {from, to} pair for history/audit.
   */
  transitionTo(target: ContractStatus): { from: ContractStatus; to: ContractStatus } {
    const from = this.props.status;
    const to = ContractStateMachine.assertTransition(from, target);
    this.props.status = to;
    return { from, to };
  }

  /** Guards editing: throws unless the contract is in DRAFT. */
  assertEditable(): void {
    if (!this.isEditable()) {
      throw new ContractInvariantError(
        `Contract ${this.props.id} is not editable in status ${this.props.status}`,
      );
    }
  }

  /** Applies editable field updates (DRAFT only) and re-checks invariants. */
  applyUpdates(patch: Partial<
    Pick<
      ContractProps,
      | 'title'
      | 'startDate'
      | 'endDate'
      | 'durationDays'
      | 'trialPeriodDays'
      | 'amount'
      | 'currency'
      | 'renewalMode'
      | 'metadata'
      | 'anneeScolaireId'
    >
  >): void {
    this.assertEditable();
    this.props = { ...this.props, ...patch };
    this.validateInvariants();
  }
}
