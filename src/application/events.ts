/** RabbitMQ routing keys for the educa.contracts topic exchange. */
export const ContractEvents = {
  CREATED: 'contract.created',
  STATUS_CHANGED: 'contract.status_changed',
  SIGNED: 'contract.signed',
  EXPIRING: 'contract.expiring',
  TERMINATED: 'contract.terminated',
} as const;

export type ContractEventKey = (typeof ContractEvents)[keyof typeof ContractEvents];
