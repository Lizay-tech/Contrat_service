import { Contract } from '../../domain/contract/Contract';
import { RenewalMode } from '../../domain/enums';
import { NotFoundError } from '../../shared/errors/AppError';
import { AuthContext } from '../../shared/types/context';
import { UseCaseDeps } from '../deps';

export interface UpdateContractInput {
  title?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  durationDays?: number | null;
  trialPeriodDays?: number | null;
  amount?: string | null;
  currency?: string;
  renewalMode?: RenewalMode;
  metadata?: Record<string, unknown>;
}

/**
 * Updates editable fields of a DRAFT contract. The domain entity rejects edits
 * outside DRAFT (ContractInvariantError -> 422).
 */
export class UpdateContract {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(
    tenantSchoolId: string,
    auth: AuthContext,
    contractId: string,
    input: UpdateContractInput,
  ): Promise<Contract> {
    const { deps } = this;
    return deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const contract = await deps.contractRepo.findById(contractId, tx);
      if (!contract) throw new NotFoundError('Contract not found');

      contract.applyUpdates(input);
      const saved = await deps.contractRepo.update(contract, tx);

      await deps.auditRepo.record(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          entityType: 'contract',
          entityId: saved.id,
          action: 'UPDATE',
          actorUserId: auth.userId,
          payload: { fields: Object.keys(input) },
          ip: null,
        },
        tx,
      );

      return saved;
    });
  }
}
