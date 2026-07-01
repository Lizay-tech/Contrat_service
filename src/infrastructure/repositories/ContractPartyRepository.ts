import {
  CreatePartyInput,
  IContractPartyRepository,
  PartyRecord,
} from '../../application/ports/repositories';
import { TxContext } from '../../application/ports/TxContext';
import { SequelizeTx } from '../database/UnitOfWork';
import { ContractPartyModel } from '../database/models';

function toRecord(m: ContractPartyModel): PartyRecord {
  return {
    id: m.id,
    tenantSchoolId: m.tenantSchoolId,
    contractId: m.contractId,
    partyType: m.partyType,
    personUserId: m.personUserId,
    schoolId: m.schoolId,
    roleInContract: m.roleInContract,
    fullName: m.fullName,
    email: m.email,
    createdAt: m.createdAt,
  };
}

export class ContractPartyRepository implements IContractPartyRepository {
  async create(input: CreatePartyInput, tx: TxContext): Promise<PartyRecord> {
    const transaction = SequelizeTx.unwrap(tx);
    const created = await ContractPartyModel.create({ ...input }, { transaction });
    return toRecord(created);
  }

  async listByContract(contractId: string, tx: TxContext): Promise<PartyRecord[]> {
    const transaction = SequelizeTx.unwrap(tx);
    const rows = await ContractPartyModel.findAll({
      where: { contractId },
      order: [['createdAt', 'ASC']],
      transaction,
    });
    return rows.map(toRecord);
  }

  async findById(id: string, tx: TxContext): Promise<PartyRecord | null> {
    const transaction = SequelizeTx.unwrap(tx);
    const found = await ContractPartyModel.findByPk(id, { transaction });
    return found ? toRecord(found) : null;
  }

  async softDelete(id: string, tx: TxContext): Promise<void> {
    const transaction = SequelizeTx.unwrap(tx);
    await ContractPartyModel.destroy({ where: { id }, transaction });
  }
}
