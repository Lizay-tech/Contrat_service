import { ContractStatus } from './enums';

/**
 * Pure domain errors — no knowledge of HTTP. The application/interface layers
 * translate them into transport-level errors (e.g. 409 for illegal transitions).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised by the state machine when a transition is not permitted. */
export class IllegalTransitionError extends DomainError {
  public readonly from: ContractStatus;
  public readonly to: ContractStatus;

  constructor(from: ContractStatus, to: ContractStatus) {
    super(`Illegal contract transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
  }
}

/** Raised when a business invariant of the Contract entity is violated. */
export class ContractInvariantError extends DomainError {}
