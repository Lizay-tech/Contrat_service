import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import { ContractStatus, enumValues } from '../../../shared/types';

export class ContractStatusHistoryModel extends Model<
  InferAttributes<ContractStatusHistoryModel>,
  InferCreationAttributes<ContractStatusHistoryModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare contract_id: string;
  declare from_status: ContractStatus | null;
  declare to_status: ContractStatus;
  declare changed_by: string;
  declare reason: string | null;
  declare changed_at: CreationOptional<Date>;
}

ContractStatusHistoryModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    contract_id: { type: DataTypes.UUID, allowNull: false },
    from_status: { type: DataTypes.ENUM(...enumValues.ContractStatus), allowNull: true },
    to_status: { type: DataTypes.ENUM(...enumValues.ContractStatus), allowNull: false },
    changed_by: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    changed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'contract_status_history',
    modelName: 'ContractStatusHistory',
    timestamps: false,
    paranoid: false,
    indexes: [
      {
        name: 'status_history_tenant_contract_idx',
        fields: ['tenant_school_id', 'contract_id'],
      },
    ],
  },
);
