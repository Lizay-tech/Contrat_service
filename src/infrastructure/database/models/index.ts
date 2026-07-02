import { ContractTypeModel } from './contract-type.model';
import { ContractModel } from './contract.model';
import { ContractPartyModel } from './contract-party.model';
import { ContractDocumentModel } from './contract-document.model';
import { ContractStatusHistoryModel } from './contract-status-history.model';
import { AuditLogModel } from './audit-log.model';
import { ContractTemplateModel } from './contract-template.model';
import { TemplateVersionModel } from './template-version.model';
import { ClauseModel, TemplateClauseModel } from './clause.model';
import { SignatureRequestModel, SignatoryModel } from './signature-request.model';

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

// ----- Templates -----
ContractTemplateModel.hasMany(TemplateVersionModel, {
  foreignKey: 'template_id',
  as: 'versions',
});
TemplateVersionModel.belongsTo(ContractTemplateModel, {
  foreignKey: 'template_id',
  as: 'template',
});

ContractTemplateModel.hasMany(TemplateClauseModel, {
  foreignKey: 'template_id',
  as: 'templateClauses',
});
TemplateClauseModel.belongsTo(ClauseModel, { foreignKey: 'clause_id', as: 'clause' });
TemplateClauseModel.belongsTo(ContractTemplateModel, {
  foreignKey: 'template_id',
  as: 'template',
});

// ----- Signature -----
SignatureRequestModel.hasMany(SignatoryModel, {
  foreignKey: 'request_id',
  as: 'signatories',
});
SignatoryModel.belongsTo(SignatureRequestModel, {
  foreignKey: 'request_id',
  as: 'request',
});
ContractModel.hasMany(SignatureRequestModel, {
  foreignKey: 'contract_id',
  as: 'signatureRequests',
});

export {
  ContractTypeModel,
  ContractModel,
  ContractPartyModel,
  ContractDocumentModel,
  ContractStatusHistoryModel,
  AuditLogModel,
  ContractTemplateModel,
  TemplateVersionModel,
  ClauseModel,
  TemplateClauseModel,
  SignatureRequestModel,
  SignatoryModel,
};
