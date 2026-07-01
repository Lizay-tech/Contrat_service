import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import { PartyType, RoleInContract, enumValues } from '../../../shared/types';

export class ContractPartyModel extends Model<
  InferAttributes<ContractPartyModel>,
  InferCreationAttributes<ContractPartyModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare contract_id: string;
  declare party_type: PartyType;
  declare person_user_id: string | null;
  declare school_id: string | null;
  declare role_in_contract: RoleInContract;
  declare full_name: string;
  declare email: string | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
}

ContractPartyModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    contract_id: { type: DataTypes.UUID, allowNull: false },
    party_type: { type: DataTypes.ENUM(...enumValues.PartyType), allowNull: false },
    person_user_id: { type: DataTypes.UUID, allowNull: true },
    school_id: { type: DataTypes.UUID, allowNull: true },
    role_in_contract: {
      type: DataTypes.ENUM(...enumValues.RoleInContract),
      allowNull: false,
    },
    full_name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'contract_parties',
    modelName: 'ContractParty',
    indexes: [
      { name: 'parties_tenant_contract_idx', fields: ['tenant_school_id', 'contract_id'] },
    ],
  },
);
