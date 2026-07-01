import { Contract } from '../../domain/contract/Contract';
import { UseCaseDeps } from '../deps';
import { ContractListFilter } from '../ports/repositories';

export interface ListContractsResult {
  items: Contract[];
  total: number;
  page: number;
  limit: number;
}

/** Paginated + filtered contract listing, scoped by RLS to the tenant. */
export class ListContracts {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(
    tenantSchoolId: string,
    filter: ContractListFilter,
  ): Promise<ListContractsResult> {
    const { items, total } = await this.deps.uow.runInTenant(tenantSchoolId, (tx) =>
      this.deps.contractRepo.list(filter, tx),
    );
    return { items, total, page: filter.page, limit: filter.limit };
  }
}
