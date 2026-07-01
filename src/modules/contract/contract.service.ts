import { env } from '../../shared/config/env';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/app-error';
import {
  ContractScope,
  ContractStatus,
  PartyType,
  RoleInContract,
  type AuthContext,
} from '../../shared/types';
import {
  assertTransition,
  INITIAL_STATUS,
  InvalidTransitionError,
} from '../../domain/contract/status-machine';
import { isEducaAdmin } from '../../interfaces/middlewares/rbac.middleware';
import { getContractTypeById } from '../contract-type/contract-type.service';
import { recordAudit, listAuditForEntity } from '../audit/audit.service';
import {
  ContractEvents,
  publishContractEvent,
} from '../../infrastructure/messaging/event-publisher';
import * as repo from './contract.repository';
import {
  serializeContract,
  serializeParty,
  serializeStatusHistory,
} from './contract.serializer';
import type {
  AddPartyInput,
  CreateContractInput,
  ListContractsQuery,
  TransitionInput,
  UpdateContractInput,
} from './contract.validator';
import type { ContractModel } from '../../infrastructure/database/models';

const ENTITY = 'contract';

export interface RequestContext {
  auth: AuthContext;
  tenantSchoolId: string;
  academicYearId: string | null;
  ip: string | null;
}

/** Recharge un contrat avec ses relations et le serialise. */
async function reloadSerialized(id: string) {
  const full = await repo.findContractWithRelations(id);
  if (!full) throw new NotFoundError('Contrat introuvable');
  return serializeContract(full);
}

/**
 * Cas d'usage: creation d'un contrat (statut initial DRAFT).
 * Gere les deux portees (PERSONNEL / ETABLISSEMENT) selon le type choisi.
 */
export async function createContract(input: CreateContractInput, ctx: RequestContext) {
  const type = await getContractTypeById(input.contractTypeId);
  if (!type.active) throw new BusinessRuleError('Type de contrat inactif');

  let tenantSchoolId: string;
  let subjectSchoolId: string | null = null;

  if (type.scope === ContractScope.ETABLISSEMENT) {
    // Contrat d'etablissement: reserve aux administrateurs EDUCA.
    if (!isEducaAdmin(ctx.auth.roleCode)) {
      throw new ForbiddenError(
        'Seul un administrateur EDUCA peut creer un contrat d\'etablissement',
      );
    }
    if (!input.subjectSchoolId) {
      throw new ValidationError('subjectSchoolId requis pour un contrat d\'etablissement');
    }
    tenantSchoolId = env.educaSystemTenantId;
    subjectSchoolId = input.subjectSchoolId;
  } else {
    // Contrat du personnel: tenant = ecole du JWT.
    tenantSchoolId = ctx.auth.schoolId;
  }

  // Coherence avec le tenant de session RLS (fixe par le middleware).
  if (tenantSchoolId !== ctx.tenantSchoolId) {
    throw new ForbiddenError('Incoherence de tenant pour la portee du contrat');
  }

  const year = input.startDate ? Number(input.startDate.slice(0, 4)) : new Date().getFullYear();
  const contractNumber = await repo.generateContractNumber(tenantSchoolId, year);

  const contract = await repo.createContract({
    tenant_school_id: tenantSchoolId,
    subject_school_id: subjectSchoolId,
    annee_scolaire_id: ctx.academicYearId,
    contract_number: contractNumber,
    contract_type_id: type.id,
    status: INITIAL_STATUS,
    title: input.title,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    duration_days: input.durationDays ?? null,
    trial_period_days: input.trialPeriodDays ?? null,
    amount: input.amount ?? null,
    currency: input.currency ?? 'HTG',
    renewal_mode: input.renewalMode ?? type.default_renewal_mode,
    owner_user_id: ctx.auth.userId,
    metadata: input.metadata ?? {},
  });

  // Pour un contrat d'etablissement, l'ecole est la partie signataire (SCHOOL).
  if (type.scope === ContractScope.ETABLISSEMENT && subjectSchoolId) {
    await repo.addParty({
      tenant_school_id: tenantSchoolId,
      contract_id: contract.id,
      party_type: PartyType.SCHOOL,
      person_user_id: null,
      school_id: subjectSchoolId,
      role_in_contract: RoleInContract.CLIENT,
      full_name: `Etablissement ${subjectSchoolId}`,
      email: null,
    });
  }

  await repo.addStatusHistory({
    tenantSchoolId,
    contractId: contract.id,
    fromStatus: null,
    toStatus: INITIAL_STATUS,
    changedBy: ctx.auth.userId,
    reason: 'Creation',
  });

  await recordAudit({
    tenantSchoolId,
    entityType: ENTITY,
    entityId: contract.id,
    action: 'CREATE',
    actorUserId: ctx.auth.userId,
    payload: { scope: type.scope, contractNumber, subjectSchoolId },
    ip: ctx.ip,
  });

  publishContractEvent(ContractEvents.CREATED, {
    contractId: contract.id,
    tenantSchoolId,
    contractTypeId: type.id,
    contractNumber,
    status: contract.status,
    scope: type.scope,
    subjectSchoolId,
  });

  return reloadSerialized(contract.id);
}

/** Cas d'usage: liste paginee + filtres. */
export async function listContracts(query: ListContractsQuery) {
  const { rows, count } = await repo.listContracts(query);
  return {
    items: rows.map(serializeContract),
    total: count,
    page: query.page,
    limit: query.limit,
  };
}

export async function getContract(id: string) {
  return reloadSerialized(id);
}

/** Cas d'usage: mise a jour des champs editables (interdit hors DRAFT). */
export async function updateContract(
  id: string,
  input: UpdateContractInput,
  ctx: RequestContext,
) {
  const contract = await repo.findContractById(id);
  if (!contract) throw new NotFoundError('Contrat introuvable');
  if (contract.status !== ContractStatus.DRAFT) {
    throw new ConflictError('Modification autorisee uniquement en statut DRAFT');
  }

  applyUpdate(contract, input);
  await repo.saveContract(contract);

  await recordAudit({
    tenantSchoolId: contract.tenant_school_id,
    entityType: ENTITY,
    entityId: contract.id,
    action: 'UPDATE',
    actorUserId: ctx.auth.userId,
    payload: { fields: Object.keys(input) },
    ip: ctx.ip,
  });

  return reloadSerialized(contract.id);
}

function applyUpdate(contract: ContractModel, input: UpdateContractInput): void {
  if (input.title !== undefined) contract.title = input.title;
  if (input.startDate !== undefined) contract.start_date = input.startDate;
  if (input.endDate !== undefined) contract.end_date = input.endDate;
  if (input.durationDays !== undefined) contract.duration_days = input.durationDays;
  if (input.trialPeriodDays !== undefined) contract.trial_period_days = input.trialPeriodDays;
  if (input.amount !== undefined) contract.amount = input.amount;
  if (input.currency !== undefined) contract.currency = input.currency;
  if (input.renewalMode !== undefined) contract.renewal_mode = input.renewalMode;
  if (input.metadata !== undefined) contract.metadata = input.metadata;
}

/** Correspondance transition -> evenement specifique publie en complement. */
function extraEventFor(from: ContractStatus, to: ContractStatus) {
  if (from === ContractStatus.PENDING_SIGNATURE && to === ContractStatus.ACTIVE) {
    return ContractEvents.SIGNED;
  }
  if (to === ContractStatus.EXPIRING) return ContractEvents.EXPIRING;
  if (to === ContractStatus.TERMINATED) return ContractEvents.TERMINATED;
  return null;
}

/** Cas d'usage: appliquer une transition de la machine a etats. */
export async function transitionStatus(
  id: string,
  input: TransitionInput,
  ctx: RequestContext,
) {
  const contract = await repo.findContractById(id);
  if (!contract) throw new NotFoundError('Contrat introuvable');

  const from = contract.status;
  try {
    assertTransition(from, input.toStatus);
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      throw new ConflictError(err.message, { from: err.from, to: err.to });
    }
    throw err;
  }

  contract.status = input.toStatus;
  await repo.saveContract(contract);

  await repo.addStatusHistory({
    tenantSchoolId: contract.tenant_school_id,
    contractId: contract.id,
    fromStatus: from,
    toStatus: input.toStatus,
    changedBy: ctx.auth.userId,
    reason: input.reason ?? null,
  });

  await recordAudit({
    tenantSchoolId: contract.tenant_school_id,
    entityType: ENTITY,
    entityId: contract.id,
    action: 'TRANSITION',
    actorUserId: ctx.auth.userId,
    payload: { from, to: input.toStatus, reason: input.reason ?? null },
    ip: ctx.ip,
  });

  const base = {
    contractId: contract.id,
    tenantSchoolId: contract.tenant_school_id,
    contractTypeId: contract.contract_type_id,
    contractNumber: contract.contract_number,
    status: contract.status,
  };
  publishContractEvent(ContractEvents.STATUS_CHANGED, { ...base, from, to: input.toStatus });
  const extra = extraEventFor(from, input.toStatus);
  if (extra) publishContractEvent(extra, base);

  return reloadSerialized(contract.id);
}

/** Cas d'usage: ajouter une partie. */
export async function addParty(id: string, input: AddPartyInput, ctx: RequestContext) {
  const contract = await repo.findContractById(id);
  if (!contract) throw new NotFoundError('Contrat introuvable');

  const party = await repo.addParty({
    tenant_school_id: contract.tenant_school_id,
    contract_id: contract.id,
    party_type: input.partyType,
    person_user_id: input.personUserId ?? null,
    school_id: input.schoolId ?? null,
    role_in_contract: input.roleInContract,
    full_name: input.fullName,
    email: input.email ?? null,
  });

  await recordAudit({
    tenantSchoolId: contract.tenant_school_id,
    entityType: 'contract_party',
    entityId: party.id,
    action: 'CREATE',
    actorUserId: ctx.auth.userId,
    payload: { contractId: contract.id, role: input.roleInContract },
    ip: ctx.ip,
  });

  return serializeParty(party);
}

/** Cas d'usage: retirer une partie. */
export async function removeParty(
  id: string,
  partyId: string,
  ctx: RequestContext,
): Promise<void> {
  const contract = await repo.findContractById(id);
  if (!contract) throw new NotFoundError('Contrat introuvable');
  const party = await repo.findParty(id, partyId);
  if (!party) throw new NotFoundError('Partie introuvable');

  await repo.removeParty(party);

  await recordAudit({
    tenantSchoolId: contract.tenant_school_id,
    entityType: 'contract_party',
    entityId: partyId,
    action: 'DELETE',
    actorUserId: ctx.auth.userId,
    payload: { contractId: id },
    ip: ctx.ip,
  });
}

/** Cas d'usage: historique des statuts + audit. */
export async function getHistory(id: string) {
  const contract = await repo.findContractById(id);
  if (!contract) throw new NotFoundError('Contrat introuvable');

  const [history, audit] = await Promise.all([
    repo.findStatusHistory(id),
    listAuditForEntity(ENTITY, id),
  ]);

  return {
    statusHistory: history.map(serializeStatusHistory),
    audit: audit.map((a) => ({
      id: a.id,
      action: a.action,
      actorUserId: a.actor_user_id,
      payload: a.payload,
      createdAt: a.created_at,
    })),
  };
}
