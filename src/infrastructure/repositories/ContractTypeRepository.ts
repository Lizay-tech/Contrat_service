import {
  ContractTypeRecord,
  IContractTypeRepository,
} from '../../application/ports/repositories';
import { TxContext } from '../../application/ports/TxContext';
import { SequelizeTx } from '../database/UnitOfWork';
import { ContractTypeModel } from '../database/models';

function toRecord(m: ContractTypeModel): ContractTypeRecord {
  return {
    id: m.id,
    code: m.code,
    label: m.label,
    scope: m.scope,
    defaultRenewalMode: m.defaultRenewalMode,
    active: m.active,
  };
}

export class ContractTypeRepository implements IContractTypeRepository {
  async listActive(tx: TxContext): Promise<ContractTypeRecord[]> {
    const transaction = SequelizeTx.unwrap(tx);
    const rows = await ContractTypeModel.findAll({
      where: { active: true },
      order: [['scope', 'ASC'], ['label', 'ASC']],
      transaction,
    });
    return rows.map(toRecord);
  }

  async findById(id: string, tx: TxContext): Promise<ContractTypeRecord | null> {
    const transaction = SequelizeTx.unwrap(tx);
    const found = await ContractTypeModel.findByPk(id, { transaction });
    return found ? toRecord(found) : null;
  }
}
