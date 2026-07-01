import { Contract } from '../../domain/contract/Contract';
import { ContractNumber } from '../../domain/contract/ContractNumber';
import { ContractStateMachine } from '../../domain/contract/ContractStateMachine';
import {
  ContractScope,
  PartyType,
  RenewalMode,
  RoleInContract,
} from '../../domain/enums';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import { env } from '../../shared/config/env';
import { UseCaseDeps } from '../deps';
import { ContractEvents } from '../events';
import { AuthContext } from '../../shared/types/context';

export interface CreateContractInput {
  contractTypeId: string;
  title: string;
  /** Only meaningful for ETABLISSEMENT scope. */
  subjectSchoolId?: string | null;
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
 * Creates a contract in DRAFT, resolving the tenant according to scope:
 *   - PERSONNEL    -> tenant = caller's JWT schoolId
 *   - ETABLISSEMENT-> tenant = EDUCA system tenant (requires an EDUCA admin role),
 *                     subjectSchoolId required, an auto SCHOOL party is attached.
 */
export class CreateContract {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(auth: AuthContext, input: CreateContractInput): Promise<Contract> {
    const { deps } = this;

    // The tenant type lookup must happen under SOME tenant RLS scope. The
    // contract_types table is reference data shared per tenant; we read it using
    // the caller's own tenant first to learn the scope.
    const callerTenant = auth.schoolId;
    const type = await deps.uow.runInTenant(callerTenant, (tx) =>
      deps.contractTypeRepo.findById(input.contractTypeId, tx),
    );
    if (!type || !type.active) {
      throw new NotFoundError('Contract type not found or inactive');
    }

    // Resolve tenant + subject according to scope.
    let tenantSchoolId: string;
    let subjectSchoolId: string | null;

    if (type.scope === ContractScope.ETABLISSEMENT) {
      if (!env.educa.adminRoles.includes(auth.roleCode)) {
        throw new ForbiddenError(
          'Only EDUCA administrators may create ETABLISSEMENT contracts',
        );
      }
      if (!input.subjectSchoolId) {
        throw new BusinessRuleError(
          'subjectSchoolId is required for ETABLISSEMENT contracts',
        );
      }
      tenantSchoolId = env.educa.systemTenantId;
      subjectSchoolId = input.subjectSchoolId;
    } else {
      tenantSchoolId = auth.schoolId; // ALWAYS from JWT, never from body
      subjectSchoolId = null;
    }

    const anneeScolaireId = await deps.anneeScolaire.getActiveYearId(tenantSchoolId);
    const now = deps.clock.now();
    const year = now.getUTCFullYear();

    const persisted = await deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const sequence = await deps.contractRepo.nextSequence(tenantSchoolId, tx);
      const contractNumber = ContractNumber.format(type.scope, year, sequence);

      const contract = new Contract({
        id: deps.ids.uuid(),
        tenantSchoolId,
        subjectSchoolId,
        anneeScolaireId,
        contractNumber,
        contractTypeId: type.id,
        scope: type.scope,
        status: ContractStateMachine.initialStatus(),
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        durationDays: input.durationDays ?? null,
        trialPeriodDays: input.trialPeriodDays ?? null,
        amount: input.amount ?? null,
        currency: input.currency ?? 'HTG',
        renewalMode: input.renewalMode ?? type.defaultRenewalMode,
        ownerUserId: auth.userId,
        title: input.title,
        metadata: input.metadata ?? {},
      });

      const saved = await deps.contractRepo.create(contract, tx);

      // For ETABLISSEMENT contracts, attach the school as a SCHOOL party.
      if (type.scope === ContractScope.ETABLISSEMENT && subjectSchoolId) {
        await deps.partyRepo.create(
          {
            id: deps.ids.uuid(),
            tenantSchoolId,
            contractId: saved.id,
            partyType: PartyType.SCHOOL,
            personUserId: null,
            schoolId: subjectSchoolId,
            roleInContract: RoleInContract.CLIENT,
            fullName: `School ${subjectSchoolId}`,
            email: null,
          },
          tx,
        );
      }

      await deps.historyRepo.append(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          contractId: saved.id,
          fromStatus: null,
          toStatus: saved.status,
          changedBy: auth.userId,
          reason: 'Contract created',
        },
        tx,
      );

      await deps.auditRepo.record(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          entityType: 'contract',
          entityId: saved.id,
          action: 'CREATE',
          actorUserId: auth.userId,
          payload: {
            contractNumber: saved.contractNumber,
            scope: saved.scope,
            contractTypeId: type.id,
          },
          ip: null,
        },
        tx,
      );

      return saved;
    });

    // Publish after commit so we never emit on rollback.
    await deps.events.publish({
      routingKey: ContractEvents.CREATED,
      payload: {
        contractId: persisted.id,
        tenantSchoolId: persisted.tenantSchoolId,
        subjectSchoolId: persisted.subjectSchoolId,
        contractNumber: persisted.contractNumber,
        scope: persisted.scope,
        status: persisted.status,
      },
    });

    return persisted;
  }
}
