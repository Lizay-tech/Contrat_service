import { ContractTypeModel } from '../../infrastructure/database/models';
import { NotFoundError } from '../../shared/errors/app-error';

/** Liste le referentiel des types de contrat actifs (table globale). */
export async function listContractTypes(onlyActive = true): Promise<ContractTypeModel[]> {
  return ContractTypeModel.findAll({
    where: onlyActive ? { active: true } : {},
    order: [['label', 'ASC']],
  });
}

export async function getContractTypeById(id: string): Promise<ContractTypeModel> {
  const type = await ContractTypeModel.findByPk(id);
  if (!type) throw new NotFoundError('Type de contrat introuvable');
  return type;
}
