import { Op, type CreationAttributes, type WhereOptions } from 'sequelize';
import {
  ContractModel,
  ContractPartyModel,
  ContractStatusHistoryModel,
  ContractTypeModel,
} from '../../infrastructure/database/models';
import { currentTransaction } from '../../infrastructure/database/tenant-context';
import type { ContractStatus, ContractScope } from '../../shared/types';
import type { ListContractsQuery } from './contract.validator';

const tx = () => currentTransaction();

/**
 * Genere un numero de contrat unique par tenant, format CT-YYYY-000001.
 * Le sequentiel est derive du nombre de contrats existants pour l'annee civile.
 * L'unicite finale est garantie par l'index unique (tenant, contract_number).
 */
export async function generateContractNumber(
  tenantSchoolId: string,
  year: number,
): Promise<string> {
  const count = await ContractModel.count({
    where: {
      tenant_school_id: tenantSchoolId,
      contract_number: { [Op.like]: `CT-${year}-%` },
    },
    paranoid: false,
    transaction: tx(),
  });
  const seq = String(count + 1).padStart(6, '0');
  return `CT-${year}-${seq}`;
}

export async function createContract(
  data: CreationAttributes<ContractModel>,
): Promise<ContractModel> {
  return ContractModel.create(data, { transaction: tx() });
}

export async function findContractById(id: string): Promise<ContractModel | null> {
  return ContractModel.findByPk(id, { transaction: tx() });
}

export async function findContractWithRelations(id: string): Promise<ContractModel | null> {
  return ContractModel.findByPk(id, {
    include: [
      { model: ContractTypeModel, as: 'contractType' },
      { model: ContractPartyModel, as: 'parties' },
      { association: 'documents' },
      {
        model: ContractStatusHistoryModel,
        as: 'statusHistory',
        separate: true,
        order: [['changed_at', 'DESC']],
      },
    ],
    transaction: tx(),
  });
}

export interface ListResult {
  rows: ContractModel[];
  count: number;
}

export async function listContracts(query: ListContractsQuery): Promise<ListResult> {
  const where: WhereOptions = {};
  const and: WhereOptions[] = [];

  if (query.status) (where as Record<string, unknown>).status = query.status;
  if (query.contractTypeId)
    (where as Record<string, unknown>).contract_type_id = query.contractTypeId;
  if (query.subjectSchoolId)
    (where as Record<string, unknown>).subject_school_id = query.subjectSchoolId;

  if (query.dateFrom || query.dateTo) {
    const range: Record<symbol, string> = {};
    if (query.dateFrom) range[Op.gte] = query.dateFrom;
    if (query.dateTo) range[Op.lte] = query.dateTo;
    (where as Record<string, unknown>).start_date = range;
  }

  if (query.search) {
    and.push({
      [Op.or]: [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { contract_number: { [Op.iLike]: `%${query.search}%` } },
      ],
    });
  }
  if (and.length) (where as Record<symbol, unknown>)[Op.and] = and;

  const { rows, count } = await ContractModel.findAndCountAll({
    where,
    include: [
      {
        model: ContractTypeModel,
        as: 'contractType',
        required: true,
        ...(query.scope ? { where: { scope: query.scope as ContractScope } } : {}),
      },
    ],
    order: [['created_at', 'DESC']],
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
    distinct: true,
    transaction: tx(),
  });

  return { rows, count };
}

export async function saveContract(contract: ContractModel): Promise<ContractModel> {
  return contract.save({ transaction: tx() });
}

export async function addStatusHistory(entry: {
  tenantSchoolId: string;
  contractId: string;
  fromStatus: ContractStatus | null;
  toStatus: ContractStatus;
  changedBy: string;
  reason?: string | null;
}): Promise<void> {
  await ContractStatusHistoryModel.create(
    {
      tenant_school_id: entry.tenantSchoolId,
      contract_id: entry.contractId,
      from_status: entry.fromStatus,
      to_status: entry.toStatus,
      changed_by: entry.changedBy,
      reason: entry.reason ?? null,
    },
    { transaction: tx() },
  );
}

export async function addParty(
  data: CreationAttributes<ContractPartyModel>,
): Promise<ContractPartyModel> {
  return ContractPartyModel.create(data, { transaction: tx() });
}

export async function findParty(
  contractId: string,
  partyId: string,
): Promise<ContractPartyModel | null> {
  return ContractPartyModel.findOne({
    where: { id: partyId, contract_id: contractId },
    transaction: tx(),
  });
}

export async function removeParty(party: ContractPartyModel): Promise<void> {
  await party.destroy({ transaction: tx() });
}

export async function findPartiesByContract(
  contractId: string,
): Promise<ContractPartyModel[]> {
  return ContractPartyModel.findAll({
    where: { contract_id: contractId },
    transaction: tx(),
  });
}

export async function findStatusHistory(
  contractId: string,
): Promise<ContractStatusHistoryModel[]> {
  return ContractStatusHistoryModel.findAll({
    where: { contract_id: contractId },
    order: [['changed_at', 'DESC']],
    transaction: tx(),
  });
}
