import { publish } from './rabbitmq';
import { logger } from '../../shared/config/logger';
import type { ContractStatus } from '../../shared/types';

/** Routing keys des evenements de cycle de vie du contrat. */
export const ContractEvents = {
  CREATED: 'contract.created',
  STATUS_CHANGED: 'contract.status_changed',
  SIGNED: 'contract.signed',
  EXPIRING: 'contract.expiring',
  TERMINATED: 'contract.terminated',
} as const;

export type ContractEventKey = (typeof ContractEvents)[keyof typeof ContractEvents];

interface BaseEventPayload {
  contractId: string;
  tenantSchoolId: string;
  contractTypeId: string;
  contractNumber: string;
  status: ContractStatus;
}

/**
 * Publie un evenement contrat. La signature enrichit le payload avec un
 * type d'evenement et un horodatage. Best-effort (cf. rabbitmq.publish).
 */
export function publishContractEvent(
  routingKey: ContractEventKey,
  payload: BaseEventPayload & Record<string, unknown>,
  timestamp: Date = new Date(),
): void {
  const enveloped = {
    event: routingKey,
    occurredAt: timestamp.toISOString(),
    ...payload,
  };
  const ok = publish(routingKey, enveloped);
  logger.debug({ routingKey, contractId: payload.contractId, published: ok }, '[event] publish');
}
