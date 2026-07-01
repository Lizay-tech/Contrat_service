import { ContractStatus } from '../enums';
import { IllegalTransitionError } from '../errors';

/**
 * Authoritative contract state machine. This is the ONLY place transitions are
 * decided. Both the domain entity and the use-cases defer to it.
 *
 * Allowed transitions (Phase 1):
 *   DRAFT             -> PENDING_APPROVAL, CANCELLED
 *   PENDING_APPROVAL  -> APPROVED, CANCELLED
 *   APPROVED          -> PENDING_SIGNATURE, CANCELLED
 *   PENDING_SIGNATURE -> ACTIVE
 *   ACTIVE            -> AMENDED, EXPIRING, TERMINATED
 *   AMENDED           -> ACTIVE
 *   EXPIRING          -> RENEWED, EXPIRED
 *   RENEWED           -> ACTIVE
 *   EXPIRED           -> ARCHIVED
 *   TERMINATED        -> ARCHIVED
 *   CANCELLED         -> (terminal)
 *   ARCHIVED          -> (terminal)
 */
const TRANSITIONS: Readonly<Record<ContractStatus, ReadonlyArray<ContractStatus>>> = {
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

export const ContractStateMachine = {
  /** Initial status for a newly created contract. */
  initialStatus(): ContractStatus {
    return ContractStatus.DRAFT;
  },

  /** Statuses reachable in one step from `from`. */
  allowedTargets(from: ContractStatus): ReadonlyArray<ContractStatus> {
    return TRANSITIONS[from] ?? [];
  },

  canTransition(from: ContractStatus, to: ContractStatus): boolean {
    return this.allowedTargets(from).includes(to);
  },

  isTerminal(status: ContractStatus): boolean {
    return this.allowedTargets(status).length === 0;
  },

  /**
   * Validates a transition, throwing IllegalTransitionError if not allowed.
   * Returns the target status on success.
   */
  assertTransition(from: ContractStatus, to: ContractStatus): ContractStatus {
    if (from === to) {
      throw new IllegalTransitionError(from, to);
    }
    if (!this.canTransition(from, to)) {
      throw new IllegalTransitionError(from, to);
    }
    return to;
  },
} as const;
