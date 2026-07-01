import { PartyType, RoleInContract } from '../../domain/enums';
import { NotFoundError } from '../../shared/errors/AppError';
import { AuthContext } from '../../shared/types/context';
import { UseCaseDeps } from '../deps';
import { PartyRecord } from '../ports/repositories';

export interface AddPartyInput {
  partyType: PartyType;
  roleInContract: RoleInContract;
  fullName: string;
  email?: string | null;
  personUserId?: string | null;
  /** Only for SCHOOL/ORG parties. */
  schoolId?: string | null;
}

export class AddParty {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(
    tenantSchoolId: string,
    auth: AuthContext,
    contractId: string,
    input: AddPartyInput,
  ): Promise<PartyRecord> {
    const { deps } = this;
    return deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const contract = await deps.contractRepo.findById(contractId, tx);
      if (!contract) throw new NotFoundError('Contract not found');

      const party = await deps.partyRepo.create(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          contractId,
          partyType: input.partyType,
          personUserId: input.personUserId ?? null,
          schoolId: input.schoolId ?? null,
          roleInContract: input.roleInContract,
          fullName: input.fullName,
          email: input.email ?? null,
        },
        tx,
      );

      await deps.auditRepo.record(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          entityType: 'contract_party',
          entityId: party.id,
          action: 'CREATE',
          actorUserId: auth.userId,
          payload: { contractId, roleInContract: input.roleInContract },
          ip: null,
        },
        tx,
      );

      return party;
    });
  }
}
