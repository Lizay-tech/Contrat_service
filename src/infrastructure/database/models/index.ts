import { ContractTypeModel } from './contract-type.model';
import { ContractModel } from './contract.model';
import { ContractPartyModel } from './contract-party.model';
import { ContractDocumentModel } from './contract-document.model';
import { ContractStatusHistoryModel } from './contract-status-history.model';
import { AuditLogModel } from './audit-log.model';

/**
 * Associations. Les modeles s'auto-enregistrent aupres de l'instance sequelize
 * au moment de l'import; ce fichier centralise les relations.
 */
ContractModel.belongsTo(ContractTypeModel, {
  foreignKey: 'contract_type_id',
  as: 'contractType',
});

ContractModel.hasMany(ContractPartyModel, {
  foreignKey: 'contract_id',
  as: 'parties',
});
ContractPartyModel.belongsTo(ContractModel, { foreignKey: 'contract_id', as: 'contract' });

ContractModel.hasMany(ContractDocumentModel, {
  foreignKey: 'contract_id',
  as: 'documents',
});
ContractDocumentModel.belongsTo(ContractModel, { foreignKey: 'contract_id', as: 'contract' });

ContractModel.hasMany(ContractStatusHistoryModel, {
  foreignKey: 'contract_id',
  as: 'statusHistory',
});
ContractStatusHistoryModel.belongsTo(ContractModel, {
  foreignKey: 'contract_id',
  as: 'contract',
});

export {
  ContractTypeModel,
  ContractModel,
  ContractPartyModel,
  ContractDocumentModel,
  ContractStatusHistoryModel,
  AuditLogModel,
};
