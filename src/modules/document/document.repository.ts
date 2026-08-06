import type { CreationAttributes } from 'sequelize';
import { ContractDocumentModel } from '../../infrastructure/database/models';
import { currentTransaction } from '../../infrastructure/database/tenant-context';

const tx = () => currentTransaction();

export async function nextVersion(contractId: string): Promise<number> {
  const max = (await ContractDocumentModel.max('version', {
    where: { contract_id: contractId },
    transaction: tx(),
  })) as number | null;
  return (max ?? 0) + 1;
}

export async function createDocument(
  data: CreationAttributes<ContractDocumentModel>,
): Promise<ContractDocumentModel> {
  return ContractDocumentModel.create(data, { transaction: tx() });
}

export async function findDocument(
  contractId: string,
  docId: string,
): Promise<ContractDocumentModel | null> {
  return ContractDocumentModel.findOne({
    where: { id: docId, contract_id: contractId },
    transaction: tx(),
  });
}

export async function listDocuments(contractId: string): Promise<ContractDocumentModel[]> {
  return ContractDocumentModel.findAll({
    where: { contract_id: contractId },
    order: [['version', 'DESC']],
    transaction: tx(),
  });
}
