import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import {
  SignatureMode,
  SignatureRequestStatus,
  SignatoryStatus,
  SignatureType,
  enumValues,
} from '../../../shared/types';

/** Demande de signature d'un contrat (suivi local; apposition PDF deleguee a 8093). */
export class SignatureRequestModel extends Model<
  InferAttributes<SignatureRequestModel>,
  InferCreationAttributes<SignatureRequestModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare contract_id: string;
  declare mode: SignatureMode;
  declare status: CreationOptional<SignatureRequestStatus>;
  declare deadline: string | null;
  declare external_ref: string | null;
  declare created_by: string;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

SignatureRequestModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    contract_id: { type: DataTypes.UUID, allowNull: false },
    mode: { type: DataTypes.ENUM(...enumValues.SignatureMode), allowNull: false },
    status: {
      type: DataTypes.ENUM(...enumValues.SignatureRequestStatus),
      allowNull: false,
      defaultValue: SignatureRequestStatus.PENDING,
    },
    deadline: { type: DataTypes.DATEONLY, allowNull: true },
    external_ref: { type: DataTypes.STRING(255), allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: false },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'signature_requests',
    modelName: 'SignatureRequest',
    paranoid: false,
    indexes: [
      { name: 'sig_requests_tenant_contract_idx', fields: ['tenant_school_id', 'contract_id'] },
    ],
  },
);

export class SignatoryModel extends Model<
  InferAttributes<SignatoryModel>,
  InferCreationAttributes<SignatoryModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare request_id: string;
  declare contract_id: string;
  declare order_index: CreationOptional<number>;
  declare user_id: string | null;
  declare name: string;
  declare email: string;
  declare status: CreationOptional<SignatoryStatus>;
  declare signature_type: SignatureType | null;
  declare signed_at: Date | null;
  declare ip: string | null;
  declare device: string | null;
  declare signature_ref: string | null;
  declare signature_render: string | null;
  declare signed_document_id: string | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

SignatoryModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    request_id: { type: DataTypes.UUID, allowNull: false },
    contract_id: { type: DataTypes.UUID, allowNull: false },
    order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    user_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    status: {
      type: DataTypes.ENUM(...enumValues.SignatoryStatus),
      allowNull: false,
      defaultValue: SignatoryStatus.PENDING,
    },
    signature_type: { type: DataTypes.ENUM(...enumValues.SignatureType), allowNull: true },
    signed_at: { type: DataTypes.DATE, allowNull: true },
    ip: { type: DataTypes.STRING(64), allowNull: true },
    device: { type: DataTypes.STRING(512), allowNull: true },
    signature_ref: { type: DataTypes.STRING(255), allowNull: true },
    signature_render: { type: DataTypes.TEXT, allowNull: true },
    signed_document_id: { type: DataTypes.UUID, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'signatories',
    modelName: 'Signatory',
    paranoid: false,
    indexes: [
      { name: 'signatories_tenant_request_idx', fields: ['tenant_school_id', 'request_id'] },
    ],
  },
);
