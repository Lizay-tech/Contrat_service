import {
  CreateDocumentInput,
  DocumentRecord,
  IContractDocumentRepository,
} from '../../application/ports/repositories';
import { TxContext } from '../../application/ports/TxContext';
import { SequelizeTx } from '../database/UnitOfWork';
import { ContractDocumentModel } from '../database/models';

function toRecord(m: ContractDocumentModel): DocumentRecord {
  return {
    id: m.id,
    tenantSchoolId: m.tenantSchoolId,
    contractId: m.contractId,
    type: m.type,
    filePath: m.filePath,
    mimeType: m.mimeType,
    sizeBytes: Number(m.sizeBytes),
    sha256Hash: m.sha256Hash,
    version: m.version,
    uploadedBy: m.uploadedBy,
    createdAt: m.createdAt,
  };
}

export class ContractDocumentRepository implements IContractDocumentRepository {
  async create(input: CreateDocumentInput, tx: TxContext): Promise<DocumentRecord> {
    const transaction = SequelizeTx.unwrap(tx);
    const created = await ContractDocumentModel.create({ ...input }, { transaction });
    return toRecord(created);
  }

  async listByContract(contractId: string, tx: TxContext): Promise<DocumentRecord[]> {
    const transaction = SequelizeTx.unwrap(tx);
    const rows = await ContractDocumentModel.findAll({
      where: { contractId },
      order: [['version', 'ASC']],
      transaction,
    });
    return rows.map(toRecord);
  }

  async findById(id: string, tx: TxContext): Promise<DocumentRecord | null> {
    const transaction = SequelizeTx.unwrap(tx);
    const found = await ContractDocumentModel.findByPk(id, { transaction });
    return found ? toRecord(found) : null;
  }

  async maxVersion(contractId: string, tx: TxContext): Promise<number> {
    const transaction = SequelizeTx.unwrap(tx);
    const max = (await ContractDocumentModel.max('version', {
      where: { contractId },
      transaction,
    })) as number | null;
    return max ?? 0;
  }
}
