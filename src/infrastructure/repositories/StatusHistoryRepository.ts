import {
  IStatusHistoryRepository,
  StatusHistoryRecord,
} from '../../application/ports/repositories';
import { TxContext } from '../../application/ports/TxContext';
import { SequelizeTx } from '../database/UnitOfWork';
import { ContractStatusHistoryModel } from '../database/models';

function toRecord(m: ContractStatusHistoryModel): StatusHistoryRecord {
  return {
    id: m.id,
    tenantSchoolId: m.tenantSchoolId,
    contractId: m.contractId,
    fromStatus: m.fromStatus,
    toStatus: m.toStatus,
    changedBy: m.changedBy,
    reason: m.reason,
    changedAt: m.changedAt,
  };
}

export class StatusHistoryRepository implements IStatusHistoryRepository {
  async append(
    input: Omit<StatusHistoryRecord, 'id' | 'changedAt'> & { id: string },
    tx: TxContext,
  ): Promise<void> {
    const transaction = SequelizeTx.unwrap(tx);
    await ContractStatusHistoryModel.create(
      {
        id: input.id,
        tenantSchoolId: input.tenantSchoolId,
        contractId: input.contractId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedBy: input.changedBy,
        reason: input.reason,
      },
      { transaction },
    );
  }

  async listByContract(contractId: string, tx: TxContext): Promise<StatusHistoryRecord[]> {
    const transaction = SequelizeTx.unwrap(tx);
    const rows = await ContractStatusHistoryModel.findAll({
      where: { contractId },
      order: [['changedAt', 'ASC']],
      transaction,
    });
    return rows.map(toRecord);
  }
}
