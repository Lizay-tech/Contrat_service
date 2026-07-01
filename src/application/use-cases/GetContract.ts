import { Contract } from '../../domain/contract/Contract';
import { NotFoundError } from '../../shared/errors/AppError';
import { UseCaseDeps } from '../deps';
import { DocumentRecord, PartyRecord, StatusHistoryRecord } from '../ports/repositories';

export interface ContractDetail {
  contract: Contract;
  parties: PartyRecord[];
  documents: DocumentRecord[];
  lastStatusChange: StatusHistoryRecord | null;
}

/** Loads a contract with its parties, documents and latest status change. */
export class GetContract {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(tenantSchoolId: string, contractId: string): Promise<ContractDetail> {
    const { deps } = this;
    return deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const contract = await deps.contractRepo.findById(contractId, tx);
      if (!contract) throw new NotFoundError('Contract not found');

      const [parties, documents, history] = await Promise.all([
        deps.partyRepo.listByContract(contractId, tx),
        deps.documentRepo.listByContract(contractId, tx),
        deps.historyRepo.listByContract(contractId, tx),
      ]);

      const lastStatusChange = history.length > 0 ? history[history.length - 1] : null;
      return { contract, parties, documents, lastStatusChange };
    });
  }
}
