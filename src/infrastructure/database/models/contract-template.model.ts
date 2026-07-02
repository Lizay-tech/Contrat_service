import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import { TemplateScopeOwner, TemplateStatus, enumValues } from '../../../shared/types';

/**
 * Modele de contrat. Un modele PREDEFINED (global EDUCA) a tenant_school_id NULL
 * et reste lisible par tous les tenants (policy RLS speciale). Un modele SCHOOL
 * appartient a une ecole (tenant_school_id renseigne) et lui est prive.
 */
export class ContractTemplateModel extends Model<
  InferAttributes<ContractTemplateModel>,
  InferCreationAttributes<ContractTemplateModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string | null;
  declare scope_owner: TemplateScopeOwner;
  declare contract_type_id: string | null;
  declare name: string;
  declare description: string | null;
  declare status: TemplateStatus;
  declare current_version: CreationOptional<number>;
  declare created_by: string | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
}

ContractTemplateModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: true },
    scope_owner: { type: DataTypes.ENUM(...enumValues.TemplateScopeOwner), allowNull: false },
    contract_type_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM(...enumValues.TemplateStatus),
      allowNull: false,
      defaultValue: TemplateStatus.DRAFT,
    },
    current_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by: { type: DataTypes.UUID, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'contract_templates',
    modelName: 'ContractTemplate',
    indexes: [
      { name: 'templates_owner_type_idx', fields: ['scope_owner', 'contract_type_id'] },
      { name: 'templates_tenant_idx', fields: ['tenant_school_id'] },
    ],
  },
);
