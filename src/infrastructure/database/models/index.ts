<<<<<<< HEAD
import {
  DataTypes,
  Model,
  Optional,
} from 'sequelize';
import { sequelize } from '../sequelize';
import {
  ContractScope,
  ContractStatus,
  DocumentType,
  PartyType,
  RenewalMode,
  RoleInContract,
} from '../../../domain/enums';

/**
 * Sequelize models mapping the Phase 1 tables. Schema itself is owned by the
 * migrations (including PG enums, RLS policies and named indexes); these models
 * only declare the shape used by the repositories.
 */

// --- contract_types ---
export interface ContractTypeAttrs {
  id: string;
  code: string;
  label: string;
  scope: ContractScope;
  defaultRenewalMode: RenewalMode;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
export class ContractTypeModel
  extends Model<ContractTypeAttrs, Optional<ContractTypeAttrs, 'id'>>
  implements ContractTypeAttrs
{
  declare id: string;
  declare code: string;
  declare label: string;
  declare scope: ContractScope;
  declare defaultRenewalMode: RenewalMode;
  declare active: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  declare readonly deletedAt: Date | null;
}
ContractTypeModel.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(255), allowNull: false },
    scope: { type: DataTypes.ENUM(...Object.values(ContractScope)), allowNull: false },
    defaultRenewalMode: {
      type: DataTypes.ENUM(...Object.values(RenewalMode)),
      allowNull: false,
      defaultValue: RenewalMode.MANUAL,
    },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'contract_types', modelName: 'ContractType' },
);

// --- contracts ---
export interface ContractAttrs {
  id: string;
  tenantSchoolId: string;
  subjectSchoolId: string | null;
  anneeScolaireId: string | null;
  contractNumber: string;
  contractTypeId: string;
  scope: ContractScope;
  status: ContractStatus;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  trialPeriodDays: number | null;
  amount: string | null;
  currency: string;
  renewalMode: RenewalMode;
  ownerUserId: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
export class ContractModel
  extends Model<ContractAttrs, Optional<ContractAttrs, 'id'>>
  implements ContractAttrs
{
  declare id: string;
  declare tenantSchoolId: string;
  declare subjectSchoolId: string | null;
  declare anneeScolaireId: string | null;
  declare contractNumber: string;
  declare contractTypeId: string;
  declare scope: ContractScope;
  declare status: ContractStatus;
  declare startDate: Date | null;
  declare endDate: Date | null;
  declare durationDays: number | null;
  declare trialPeriodDays: number | null;
  declare amount: string | null;
  declare currency: string;
  declare renewalMode: RenewalMode;
  declare ownerUserId: string;
  declare title: string;
  declare metadata: Record<string, unknown>;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  declare readonly deletedAt: Date | null;
}
ContractModel.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantSchoolId: { type: DataTypes.UUID, allowNull: false },
    subjectSchoolId: { type: DataTypes.UUID, allowNull: true },
    anneeScolaireId: { type: DataTypes.UUID, allowNull: true },
    contractNumber: { type: DataTypes.STRING(64), allowNull: false },
    contractTypeId: { type: DataTypes.UUID, allowNull: false },
    scope: { type: DataTypes.ENUM(...Object.values(ContractScope)), allowNull: false },
    status: {
      type: DataTypes.ENUM(...Object.values(ContractStatus)),
      allowNull: false,
      defaultValue: ContractStatus.DRAFT,
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
    durationDays: { type: DataTypes.INTEGER, allowNull: true },
    trialPeriodDays: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'HTG' },
    renewalMode: {
      type: DataTypes.ENUM(...Object.values(RenewalMode)),
      allowNull: false,
      defaultValue: RenewalMode.MANUAL,
    },
    ownerUserId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  { sequelize, tableName: 'contracts', modelName: 'Contract' },
);

// --- contract_parties ---
export interface ContractPartyAttrs {
  id: string;
  tenantSchoolId: string;
  contractId: string;
  partyType: PartyType;
  personUserId: string | null;
  schoolId: string | null;
  roleInContract: RoleInContract;
  fullName: string;
  email: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
export class ContractPartyModel
  extends Model<ContractPartyAttrs, Optional<ContractPartyAttrs, 'id'>>
  implements ContractPartyAttrs
{
  declare id: string;
  declare tenantSchoolId: string;
  declare contractId: string;
  declare partyType: PartyType;
  declare personUserId: string | null;
  declare schoolId: string | null;
  declare roleInContract: RoleInContract;
  declare fullName: string;
  declare email: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  declare readonly deletedAt: Date | null;
}
ContractPartyModel.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantSchoolId: { type: DataTypes.UUID, allowNull: false },
    contractId: { type: DataTypes.UUID, allowNull: false },
    partyType: { type: DataTypes.ENUM(...Object.values(PartyType)), allowNull: false },
    personUserId: { type: DataTypes.UUID, allowNull: true },
    schoolId: { type: DataTypes.UUID, allowNull: true },
    roleInContract: {
      type: DataTypes.ENUM(...Object.values(RoleInContract)),
      allowNull: false,
    },
    fullName: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: true },
  },
  { sequelize, tableName: 'contract_parties', modelName: 'ContractParty' },
);

// --- contract_documents ---
export interface ContractDocumentAttrs {
  id: string;
  tenantSchoolId: string;
  contractId: string;
  type: DocumentType;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  version: number;
  uploadedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
export class ContractDocumentModel
  extends Model<ContractDocumentAttrs, Optional<ContractDocumentAttrs, 'id'>>
  implements ContractDocumentAttrs
{
  declare id: string;
  declare tenantSchoolId: string;
  declare contractId: string;
  declare type: DocumentType;
  declare filePath: string;
  declare mimeType: string;
  declare sizeBytes: number;
  declare sha256Hash: string;
  declare version: number;
  declare uploadedBy: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  declare readonly deletedAt: Date | null;
}
ContractDocumentModel.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantSchoolId: { type: DataTypes.UUID, allowNull: false },
    contractId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM(...Object.values(DocumentType)), allowNull: false },
    filePath: { type: DataTypes.STRING(1024), allowNull: false },
    mimeType: { type: DataTypes.STRING(128), allowNull: false },
    sizeBytes: { type: DataTypes.BIGINT, allowNull: false },
    sha256Hash: { type: DataTypes.STRING(64), allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    uploadedBy: { type: DataTypes.UUID, allowNull: false },
  },
  { sequelize, tableName: 'contract_documents', modelName: 'ContractDocument' },
);

// --- contract_status_history ---
export interface ContractStatusHistoryAttrs {
  id: string;
  tenantSchoolId: string;
  contractId: string;
  fromStatus: ContractStatus | null;
  toStatus: ContractStatus;
  changedBy: string;
  reason: string | null;
  changedAt: Date;
}
export class ContractStatusHistoryModel
  extends Model<ContractStatusHistoryAttrs, Optional<ContractStatusHistoryAttrs, 'id' | 'changedAt'>>
  implements ContractStatusHistoryAttrs
{
  declare id: string;
  declare tenantSchoolId: string;
  declare contractId: string;
  declare fromStatus: ContractStatus | null;
  declare toStatus: ContractStatus;
  declare changedBy: string;
  declare reason: string | null;
  declare changedAt: Date;
}
ContractStatusHistoryModel.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantSchoolId: { type: DataTypes.UUID, allowNull: false },
    contractId: { type: DataTypes.UUID, allowNull: false },
    fromStatus: { type: DataTypes.ENUM(...Object.values(ContractStatus)), allowNull: true },
    toStatus: { type: DataTypes.ENUM(...Object.values(ContractStatus)), allowNull: false },
    changedBy: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    changedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'contract_status_history',
    modelName: 'ContractStatusHistory',
    timestamps: false,
    paranoid: false,
  },
);

// --- audit_logs (immutable, append-only) ---
export interface AuditLogAttrs {
  id: string;
  tenantSchoolId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  payload: Record<string, unknown>;
  ip: string | null;
  createdAt: Date;
}
export class AuditLogModel
  extends Model<AuditLogAttrs, Optional<AuditLogAttrs, 'id' | 'createdAt'>>
  implements AuditLogAttrs
{
  declare id: string;
  declare tenantSchoolId: string;
  declare entityType: string;
  declare entityId: string;
  declare action: string;
  declare actorUserId: string | null;
  declare payload: Record<string, unknown>;
  declare ip: string | null;
  declare createdAt: Date;
}
AuditLogModel.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantSchoolId: { type: DataTypes.UUID, allowNull: false },
    entityType: { type: DataTypes.STRING(64), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
    action: { type: DataTypes.STRING(64), allowNull: false },
    actorUserId: { type: DataTypes.UUID, allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ip: { type: DataTypes.STRING(64), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    modelName: 'AuditLog',
    timestamps: false,
    paranoid: false,
    updatedAt: false,
  },
);

// Associations (read-side convenience only)
ContractModel.belongsTo(ContractTypeModel, {
  foreignKey: 'contractTypeId',
  as: 'contractType',
});
ContractModel.hasMany(ContractPartyModel, { foreignKey: 'contractId', as: 'parties' });
ContractModel.hasMany(ContractDocumentModel, {
  foreignKey: 'contractId',
  as: 'documents',
});
ContractModel.hasMany(ContractStatusHistoryModel, {
  foreignKey: 'contractId',
  as: 'statusHistory',
});
=======
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
import { ContractServiceLineModel } from './contract-service-line.model';
import { ContractVersionModel } from './contract-version.model';

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

// ----- Abonnement etablissement -----
ContractModel.hasMany(ContractServiceLineModel, {
  foreignKey: 'contract_id',
  as: 'serviceLines',
});
ContractServiceLineModel.belongsTo(ContractModel, { foreignKey: 'contract_id', as: 'contract' });

ContractModel.hasMany(ContractVersionModel, {
  foreignKey: 'contract_id',
  as: 'versions',
});
ContractVersionModel.belongsTo(ContractModel, { foreignKey: 'contract_id', as: 'contract' });

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
  ContractServiceLineModel,
  ContractVersionModel,
};
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
