import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import { ContractScope, RenewalMode, enumValues } from '../../../shared/types';

/**
 * Referentiel des types de contrat (seede). Table GLOBALE non filtree par tenant
 * (pas de tenant_school_id): partagee par toute la plateforme.
 */
export class ContractTypeModel extends Model<
  InferAttributes<ContractTypeModel>,
  InferCreationAttributes<ContractTypeModel>
> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare label: string;
  declare scope: ContractScope;
  declare default_renewal_mode: RenewalMode;
  declare active: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
}

ContractTypeModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(255), allowNull: false },
    scope: { type: DataTypes.ENUM(...enumValues.ContractScope), allowNull: false },
    default_renewal_mode: {
      type: DataTypes.ENUM(...enumValues.RenewalMode),
      allowNull: false,
      defaultValue: RenewalMode.MANUAL,
    },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'contract_types', modelName: 'ContractType' },
);
