import { NotFoundError } from '../../shared/errors/AppError';
import { UseCaseDeps } from '../deps';
import { AuditLogRecord, StatusHistoryRecord } from '../ports/repositories';

export interface ContractHistory {
  statusHistory: StatusHistoryRecord[];
  audit: AuditLogRecord[];
}

/** Returns the status-transition history plus the audit trail for a contract. */
export class GetContractHistory {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(tenantSchoolId: string, contractId: string): Promise<ContractHistory> {
    const { deps } = this;
    return deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const contract = await deps.contractRepo.findById(contractId, tx);
      if (!contract) throw new NotFoundError('Contract not found');

      const [statusHistory, audit] = await Promise.all([
        deps.historyRepo.listByContract(contractId, tx),
        deps.auditRepo.listByEntity('contract', contractId, tx),
      ]);

      return { statusHistory, audit };
    });
  }
}
