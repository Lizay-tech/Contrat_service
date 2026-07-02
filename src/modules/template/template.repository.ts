import { Op, type CreationAttributes, type WhereOptions } from 'sequelize';
import {
  ContractModel,
  ContractTemplateModel,
  TemplateVersionModel,
} from '../../infrastructure/database/models';
import { currentTransaction } from '../../infrastructure/database/tenant-context';
import type { TemplateStatus } from '../../shared/types';
import type { ListTemplatesQuery } from './template.validator';

const tx = () => currentTransaction();

export async function listTemplates(query: ListTemplatesQuery) {
  const where: WhereOptions = {};
  const w = where as Record<string, unknown>;
  if (query.scopeOwner) w.scope_owner = query.scopeOwner;
  if (query.contractTypeId) w.contract_type_id = query.contractTypeId;
  if (query.status) w.status = query.status as TemplateStatus;
  if (query.search) w.name = { [Op.iLike]: `%${query.search}%` };

  return ContractTemplateModel.findAndCountAll({
    where,
    order: [
      ['scope_owner', 'ASC'],
      ['name', 'ASC'],
    ],
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
    transaction: tx(),
  });
}

export async function findTemplateById(id: string): Promise<ContractTemplateModel | null> {
  return ContractTemplateModel.findByPk(id, { transaction: tx() });
}

export async function findTemplateWithVersions(
  id: string,
): Promise<ContractTemplateModel | null> {
  return ContractTemplateModel.findByPk(id, {
    include: [
      {
        model: TemplateVersionModel,
        as: 'versions',
        separate: true,
        order: [['version', 'DESC']],
      },
    ],
    transaction: tx(),
  });
}

export async function createTemplate(
  data: CreationAttributes<ContractTemplateModel>,
): Promise<ContractTemplateModel> {
  return ContractTemplateModel.create(data, { transaction: tx() });
}

export async function saveTemplate(t: ContractTemplateModel): Promise<ContractTemplateModel> {
  return t.save({ transaction: tx() });
}

export async function softDeleteTemplate(t: ContractTemplateModel): Promise<void> {
  await t.destroy({ transaction: tx() });
}

export async function createVersion(
  data: CreationAttributes<TemplateVersionModel>,
): Promise<TemplateVersionModel> {
  return TemplateVersionModel.create(data, { transaction: tx() });
}

export async function saveVersion(v: TemplateVersionModel): Promise<TemplateVersionModel> {
  return v.save({ transaction: tx() });
}

export async function listVersions(templateId: string): Promise<TemplateVersionModel[]> {
  return TemplateVersionModel.findAll({
    where: { template_id: templateId },
    order: [['version', 'DESC']],
    transaction: tx(),
  });
}

export async function findVersion(
  templateId: string,
  version: number,
): Promise<TemplateVersionModel | null> {
  return TemplateVersionModel.findOne({
    where: { template_id: templateId, version },
    transaction: tx(),
  });
}

export async function findLatestVersion(
  templateId: string,
): Promise<TemplateVersionModel | null> {
  return TemplateVersionModel.findOne({
    where: { template_id: templateId },
    order: [['version', 'DESC']],
    transaction: tx(),
  });
}

export async function countContractsUsingTemplate(templateId: string): Promise<number> {
  return ContractModel.count({ where: { template_id: templateId }, transaction: tx() });
}
