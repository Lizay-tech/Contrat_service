import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import type { VariableDefinition } from '../../../domain/template/variable-catalogue';

/**
 * Version figee d'un modele. Le corps (body) contient le HTML restreint + jetons
 * {{...}}. Les variables detectees sont stockees en jsonb (source de verite
 * versionnee, cf. decision de conception). tenant_school_id herite du template
 * pour permettre le filtrage RLS des versions des modeles SCHOOL.
 */
export class TemplateVersionModel extends Model<
  InferAttributes<TemplateVersionModel>,
  InferCreationAttributes<TemplateVersionModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string | null;
  declare is_predefined: CreationOptional<boolean>;
  declare template_id: string;
  declare version: number;
  declare body: string;
  declare header: string | null;
  declare footer: string | null;
  declare variables: CreationOptional<VariableDefinition[]>;
  declare changelog: string | null;
  declare published_at: Date | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

TemplateVersionModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: true },
    is_predefined: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    template_id: { type: DataTypes.UUID, allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    header: { type: DataTypes.TEXT, allowNull: true },
    footer: { type: DataTypes.TEXT, allowNull: true },
    variables: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    changelog: { type: DataTypes.TEXT, allowNull: true },
    published_at: { type: DataTypes.DATE, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'template_versions',
    modelName: 'TemplateVersion',
    paranoid: false,
    indexes: [
      {
        name: 'template_versions_tpl_version_uq',
        unique: true,
        fields: ['template_id', 'version'],
      },
    ],
  },
);
