import { Contract } from '../../domain/contract/Contract';
import { ContractStatus } from '../../domain/enums';
import { NotFoundError } from '../../shared/errors/AppError';
import { AuthContext } from '../../shared/types/context';
import { UseCaseDeps } from '../deps';
import { ContractEvents } from '../events';

export interface TransitionInput {
  toStatus: ContractStatus;
  reason?: string | null;
}

/**
 * Applies a status transition through the domain state machine, journals it in
 * status history + audit, and publishes the relevant RabbitMQ events. An illegal
 * transition throws IllegalTransitionError (mapped to 409 by the error handler),
 * leaving the contract untouched (the whole op runs in one transaction).
 */
export class TransitionContractStatus {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(
    tenantSchoolId: string,
    auth: AuthContext,
    contractId: string,
    input: TransitionInput,
  ): Promise<Contract> {
    const { deps } = this;

    const { contract, transition } = await deps.uow.runInTenant(
      tenantSchoolId,
      async (tx) => {
        const loaded = await deps.contractRepo.findById(contractId, tx);
        if (!loaded) throw new NotFoundError('Contract not found');

        // Domain is the sole authority: throws on illegal transition.
        const t = loaded.transitionTo(input.toStatus);
        const saved = await deps.contractRepo.update(loaded, tx);

        await deps.historyRepo.append(
          {
            id: deps.ids.uuid(),
            tenantSchoolId,
            contractId: saved.id,
            fromStatus: t.from,
            toStatus: t.to,
            changedBy: auth.userId,
            reason: input.reason ?? null,
          },
          tx,
        );

        await deps.auditRepo.record(
          {
            id: deps.ids.uuid(),
            tenantSchoolId,
            entityType: 'contract',
            entityId: saved.id,
            action: 'TRANSITION',
            actorUserId: auth.userId,
            payload: { from: t.from, to: t.to, reason: input.reason ?? null },
            ip: null,
          },
          tx,
        );

        return { contract: saved, transition: t };
      },
    );

    // Always publish the generic status change...
    await deps.events.publish({
      routingKey: ContractEvents.STATUS_CHANGED,
      payload: {
        contractId: contract.id,
        tenantSchoolId,
        from: transition.from,
        to: transition.to,
      },
    });

    // ...plus a specific event for milestone statuses.
    const specific = this.specificEventFor(transition.to);
    if (specific) {
      await deps.events.publish({
        routingKey: specific,
        payload: {
          contractId: contract.id,
          tenantSchoolId,
          status: transition.to,
        },
      });
    }

    return contract;
  }

  private specificEventFor(to: ContractStatus): string | null {
    switch (to) {
      case ContractStatus.ACTIVE:
        return ContractEvents.SIGNED;
      case ContractStatus.EXPIRING:
        return ContractEvents.EXPIRING;
      case ContractStatus.TERMINATED:
        return ContractEvents.TERMINATED;
      default:
        return null;
    }
  }
}
