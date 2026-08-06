import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';

/** Bibliotheque de clauses reutilisables (rendu par concatenation ordonnee). */
export class ClauseModel extends Model<
  InferAttributes<ClauseModel>,
  InferCreationAttributes<ClauseModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string | null;
  declare category: string;
  declare title: string;
  declare body: string;
  declare version: CreationOptional<number>;
  declare active: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
}

ClauseModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: true },
    category: { type: DataTypes.STRING(128), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'clauses',
    modelName: 'Clause',
    indexes: [{ name: 'clauses_tenant_category_idx', fields: ['tenant_school_id', 'category'] }],
  },
);

/** Association ordonnee clause <-> template. */
export class TemplateClauseModel extends Model<
  InferAttributes<TemplateClauseModel>,
  InferCreationAttributes<TemplateClauseModel>
> {
  declare id: CreationOptional<string>;
  declare template_id: string;
  declare clause_id: string;
  declare position: number;
}

TemplateClauseModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    template_id: { type: DataTypes.UUID, allowNull: false },
    clause_id: { type: DataTypes.UUID, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: 'template_clauses',
    modelName: 'TemplateClause',
    timestamps: false,
    paranoid: false,
    indexes: [
      { name: 'template_clauses_tpl_pos_idx', fields: ['template_id', 'position'] },
    ],
  },
);
