import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import { DocumentType, enumValues } from '../../../shared/types';

export class ContractDocumentModel extends Model<
  InferAttributes<ContractDocumentModel>,
  InferCreationAttributes<ContractDocumentModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare contract_id: string;
  declare type: DocumentType;
  declare file_path: string;
  declare original_name: string;
  declare mime_type: string;
  declare size_bytes: number;
  declare sha256_hash: string;
  declare version: number;
  declare uploaded_by: string;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
}

ContractDocumentModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    contract_id: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM(...enumValues.DocumentType), allowNull: false },
    file_path: { type: DataTypes.STRING(1024), allowNull: false },
    original_name: { type: DataTypes.STRING(512), allowNull: false },
    mime_type: { type: DataTypes.STRING(128), allowNull: false },
    size_bytes: { type: DataTypes.BIGINT, allowNull: false },
    sha256_hash: { type: DataTypes.STRING(64), allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    uploaded_by: { type: DataTypes.UUID, allowNull: false },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'contract_documents',
    modelName: 'ContractDocument',
    indexes: [
      { name: 'documents_tenant_contract_idx', fields: ['tenant_school_id', 'contract_id'] },
      { name: 'documents_sha256_idx', fields: ['sha256_hash'] },
    ],
  },
);

ContractDocumentModel.addHook('afterFind', (result) => {
  const rows = Array.isArray(result) ? result : result ? [result] : [];
  for (const row of rows as ContractDocumentModel[]) {
    if (row && row.size_bytes != null) row.size_bytes = Number(row.size_bytes);
  }
});
