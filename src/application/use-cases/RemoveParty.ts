import { NotFoundError } from '../../shared/errors/AppError';
import { AuthContext } from '../../shared/types/context';
import { UseCaseDeps } from '../deps';

export class RemoveParty {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(
    tenantSchoolId: string,
    auth: AuthContext,
    contractId: string,
    partyId: string,
  ): Promise<void> {
    const { deps } = this;
    await deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const party = await deps.partyRepo.findById(partyId, tx);
      if (!party || party.contractId !== contractId) {
        throw new NotFoundError('Party not found for this contract');
      }

      await deps.partyRepo.softDelete(partyId, tx);

      await deps.auditRepo.record(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          entityType: 'contract_party',
          entityId: partyId,
          action: 'DELETE',
          actorUserId: auth.userId,
          payload: { contractId },
          ip: null,
        },
        tx,
      );
    });
  }
}
