import { UseCaseDeps } from '../deps';
import { ContractTypeRecord } from '../ports/repositories';

/** Lists the active contract-type reference catalogue for the tenant. */
export class ListContractTypes {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(tenantSchoolId: string): Promise<ContractTypeRecord[]> {
    return this.deps.uow.runInTenant(tenantSchoolId, (tx) =>
      this.deps.contractTypeRepo.listActive(tx),
    );
  }
}
