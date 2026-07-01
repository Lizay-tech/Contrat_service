import {
  AuditLogInput,
  AuditLogRecord,
  IAuditLogRepository,
} from '../../application/ports/repositories';
import { TxContext } from '../../application/ports/TxContext';
import { SequelizeTx } from '../database/UnitOfWork';
import { AuditLogModel } from '../database/models';

function toRecord(m: AuditLogModel): AuditLogRecord {
  return {
    id: m.id,
    tenantSchoolId: m.tenantSchoolId,
    entityType: m.entityType,
    entityId: m.entityId,
    action: m.action,
    actorUserId: m.actorUserId,
    payload: m.payload,
    ip: m.ip,
    createdAt: m.createdAt,
  };
}

export class AuditLogRepository implements IAuditLogRepository {
  async record(input: AuditLogInput, tx: TxContext): Promise<void> {
    const transaction = SequelizeTx.unwrap(tx);
    await AuditLogModel.create({ ...input }, { transaction });
  }

  async listByEntity(
    entityType: string,
    entityId: string,
    tx: TxContext,
  ): Promise<AuditLogRecord[]> {
    const transaction = SequelizeTx.unwrap(tx);
    const rows = await AuditLogModel.findAll({
      where: { entityType, entityId },
      order: [['createdAt', 'ASC']],
      transaction,
    });
    return rows.map(toRecord);
  }
}
