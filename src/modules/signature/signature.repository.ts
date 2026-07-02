import type { CreationAttributes } from 'sequelize';
import {
  SignatoryModel,
  SignatureRequestModel,
} from '../../infrastructure/database/models';
import { currentTransaction } from '../../infrastructure/database/tenant-context';

const tx = () => currentTransaction();

export async function createRequest(
  data: CreationAttributes<SignatureRequestModel>,
): Promise<SignatureRequestModel> {
  return SignatureRequestModel.create(data, { transaction: tx() });
}

export async function createSignatory(
  data: CreationAttributes<SignatoryModel>,
): Promise<SignatoryModel> {
  return SignatoryModel.create(data, { transaction: tx() });
}

export async function findRequestById(id: string): Promise<SignatureRequestModel | null> {
  return SignatureRequestModel.findByPk(id, { transaction: tx() });
}

export async function saveRequest(r: SignatureRequestModel): Promise<SignatureRequestModel> {
  return r.save({ transaction: tx() });
}

export async function saveSignatory(s: SignatoryModel): Promise<SignatoryModel> {
  return s.save({ transaction: tx() });
}

export async function findSignatory(
  requestId: string,
  signatoryId: string,
): Promise<SignatoryModel | null> {
  return SignatoryModel.findOne({
    where: { id: signatoryId, request_id: requestId },
    transaction: tx(),
  });
}

export async function listSignatories(requestId: string): Promise<SignatoryModel[]> {
  return SignatoryModel.findAll({
    where: { request_id: requestId },
    order: [['order_index', 'ASC']],
    transaction: tx(),
  });
}

export async function listRequestsByContract(
  contractId: string,
): Promise<SignatureRequestModel[]> {
  return SignatureRequestModel.findAll({
    where: { contract_id: contractId },
    order: [['created_at', 'DESC']],
    transaction: tx(),
  });
}
