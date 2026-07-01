import { Op, QueryTypes, WhereOptions } from 'sequelize';
import { Contract } from '../../domain/contract/Contract';
import {
  ContractListFilter,
  IContractRepository,
} from '../../application/ports/repositories';
import { TxContext } from '../../application/ports/TxContext';
import { sequelize } from '../database/sequelize';
import { SequelizeTx } from '../database/UnitOfWork';
import { ContractAttrs, ContractModel } from '../database/models';

function toDomain(m: ContractModel): Contract {
  const a = m.get({ plain: true }) as ContractAttrs;
  return new Contract({
    id: a.id,
    tenantSchoolId: a.tenantSchoolId,
    subjectSchoolId: a.subjectSchoolId,
    anneeScolaireId: a.anneeScolaireId,
    contractNumber: a.contractNumber,
    contractTypeId: a.contractTypeId,
    scope: a.scope,
    status: a.status,
    startDate: a.startDate ? new Date(a.startDate) : null,
    endDate: a.endDate ? new Date(a.endDate) : null,
    durationDays: a.durationDays,
    trialPeriodDays: a.trialPeriodDays,
    amount: a.amount,
    currency: a.currency,
    renewalMode: a.renewalMode,
    ownerUserId: a.ownerUserId,
    title: a.title,
    metadata: a.metadata ?? {},
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });
}

export class ContractRepository implements IContractRepository {
  async nextSequence(tenantSchoolId: string, tx: TxContext): Promise<number> {
    const transaction = SequelizeTx.unwrap(tx);
    const rows = await sequelize.query<{ last_value: string }>(
      `INSERT INTO contract_sequences (tenant_school_id, last_value)
       VALUES (:tenant, 1)
       ON CONFLICT (tenant_school_id)
         DO UPDATE SET last_value = contract_sequences.last_value + 1
       RETURNING last_value;`,
      {
        replacements: { tenant: tenantSchoolId },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    return Number(rows[0].last_value);
  }

  async create(contract: Contract, tx: TxContext): Promise<Contract> {
    const transaction = SequelizeTx.unwrap(tx);
    const p = contract.toJSON();
    const created = await ContractModel.create(
      {
        id: p.id,
        tenantSchoolId: p.tenantSchoolId,
        subjectSchoolId: p.subjectSchoolId,
        anneeScolaireId: p.anneeScolaireId,
        contractNumber: p.contractNumber,
        contractTypeId: p.contractTypeId,
        scope: p.scope,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        durationDays: p.durationDays,
        trialPeriodDays: p.trialPeriodDays,
        amount: p.amount,
        currency: p.currency,
        renewalMode: p.renewalMode,
        ownerUserId: p.ownerUserId,
        title: p.title,
        metadata: p.metadata,
      },
      { transaction },
    );
    return toDomain(created);
  }

  async findById(id: string, tx: TxContext): Promise<Contract | null> {
    const transaction = SequelizeTx.unwrap(tx);
    const found = await ContractModel.findByPk(id, { transaction });
    return found ? toDomain(found) : null;
  }

  async update(contract: Contract, tx: TxContext): Promise<Contract> {
    const transaction = SequelizeTx.unwrap(tx);
    const p = contract.toJSON();
    await ContractModel.update(
      {
        status: p.status,
        title: p.title,
        subjectSchoolId: p.subjectSchoolId,
        anneeScolaireId: p.anneeScolaireId,
        startDate: p.startDate,
        endDate: p.endDate,
        durationDays: p.durationDays,
        trialPeriodDays: p.trialPeriodDays,
        amount: p.amount,
        currency: p.currency,
        renewalMode: p.renewalMode,
        metadata: p.metadata,
      },
      { where: { id: p.id }, transaction },
    );
    const reloaded = await ContractModel.findByPk(p.id, { transaction });
    if (!reloaded) throw new Error(`Contract ${p.id} vanished during update`);
    return toDomain(reloaded);
  }

  async list(
    filter: ContractListFilter,
    tx: TxContext,
  ): Promise<{ items: Contract[]; total: number }> {
    const transaction = SequelizeTx.unwrap(tx);
    const where: WhereOptions<ContractAttrs> = {};

    if (filter.status) (where as Record<string, unknown>).status = filter.status;
    if (filter.contractTypeId)
      (where as Record<string, unknown>).contractTypeId = filter.contractTypeId;
    if (filter.scope) (where as Record<string, unknown>).scope = filter.scope;
    if (filter.subjectSchoolId)
      (where as Record<string, unknown>).subjectSchoolId = filter.subjectSchoolId;

    if (filter.startDateFrom || filter.startDateTo) {
      const range: Record<symbol, Date> = {};
      if (filter.startDateFrom) range[Op.gte] = filter.startDateFrom;
      if (filter.startDateTo) range[Op.lte] = filter.startDateTo;
      (where as Record<string, unknown>).startDate = range;
    }

    if (filter.search && filter.search.trim().length > 0) {
      const term = `%${filter.search.trim()}%`;
      (where as Record<string, unknown>)[Op.or as unknown as string] = [
        { title: { [Op.iLike]: term } },
        { contractNumber: { [Op.iLike]: term } },
      ];
    }

    const offset = (filter.page - 1) * filter.limit;
    const { rows, count } = await ContractModel.findAndCountAll({
      where,
      limit: filter.limit,
      offset,
      order: [['createdAt', 'DESC']],
      transaction,
    });

    return { items: rows.map(toDomain), total: count };
  }
}
