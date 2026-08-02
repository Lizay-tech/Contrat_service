import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';

/**
 * Version figee d'un contrat.
 *
 * Distincte de `contract_status_history`, qui trace les transitions d'ETAT :
 * ici on fige le CONTENU. `snapshot` conserve le contrat et ses lignes tels
 * qu'ils etaient au moment du figeage, ce qui permet de relire la V1 apres
 * passage en V3 — y compris apres qu'un service ait ete retire du catalogue.
 *
 * Table append-only (policy RLS SELECT + INSERT uniquement) : une version
 * modifiable ne prouverait plus rien de ce qui a ete signe.
 */
export class ContractVersionModel extends Model<
  InferAttributes<ContractVersionModel>,
  InferCreationAttributes<ContractVersionModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare contract_id: string;
  declare version: number;
  declare snapshot: CreationOptional<Record<string, unknown>>;
  /** Ce qui a motive la nouvelle version, en clair. */
  declare change_reason: string | null;
  declare created_by: string;
  declare created_at: CreationOptional<Date>;
}

ContractVersionModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    contract_id: { type: DataTypes.UUID, allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false },
    snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    change_reason: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: false },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'contract_versions',
    modelName: 'ContractVersion',
    // Append-only : aucune colonne `updated_at`, aucune mise a jour attendue.
    updatedAt: false,
    indexes: [
      { name: 'contract_versions_tenant_contract_idx', fields: ['tenant_school_id', 'contract_id'] },
    ],
  },
);
