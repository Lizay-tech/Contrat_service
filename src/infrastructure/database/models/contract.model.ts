import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import { ContractStatus, RenewalMode, enumValues } from '../../../shared/types';

export class ContractModel extends Model<
  InferAttributes<ContractModel>,
  InferCreationAttributes<ContractModel>
> {
  declare id: CreationOptional<string>;
  /** Clef RLS: proprietaire de l'enregistrement (toujours issu du JWT / tenant systeme). */
  declare tenant_school_id: string;
  /** Ecole objet du contrat (contrats ETABLISSEMENT uniquement). */
  declare subject_school_id: string | null;
  declare annee_scolaire_id: string | null;
  declare contract_number: string;
  declare contract_type_id: string;
  declare status: ContractStatus;
  declare title: string;
  declare start_date: string | null;
  declare end_date: string | null;
  declare duration_days: number | null;
  declare trial_period_days: number | null;
  declare amount: number | null;
  declare currency: CreationOptional<string>;
  declare renewal_mode: RenewalMode;
  declare owner_user_id: string;
  declare template_id: string | null;
  declare template_version: number | null;
  declare rendered_body: string | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
  declare deleted_at: CreationOptional<Date | null>;
}

ContractModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    subject_school_id: { type: DataTypes.UUID, allowNull: true },
    annee_scolaire_id: { type: DataTypes.UUID, allowNull: true },
    contract_number: { type: DataTypes.STRING(64), allowNull: false },
    contract_type_id: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM(...enumValues.ContractStatus),
      allowNull: false,
      defaultValue: ContractStatus.DRAFT,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    duration_days: { type: DataTypes.INTEGER, allowNull: true },
    trial_period_days: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'HTG' },
    renewal_mode: {
      type: DataTypes.ENUM(...enumValues.RenewalMode),
      allowNull: false,
      defaultValue: RenewalMode.MANUAL,
    },
    owner_user_id: { type: DataTypes.UUID, allowNull: false },
    template_id: { type: DataTypes.UUID, allowNull: true },
    template_version: { type: DataTypes.INTEGER, allowNull: true },
    rendered_body: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'contracts',
    modelName: 'Contract',
    indexes: [
      {
        name: 'contracts_tenant_number_uq',
        unique: true,
        fields: ['tenant_school_id', 'contract_number'],
        where: { deleted_at: null },
      },
      { name: 'contracts_tenant_status_idx', fields: ['tenant_school_id', 'status'] },
      { name: 'contracts_subject_school_idx', fields: ['subject_school_id'] },
      { name: 'contracts_type_idx', fields: ['contract_type_id'] },
    ],
  },
);

/**
 * DECIMAL est renvoye en string par pg. On force un nombre en sortie pour rester
 * coherent avec le typage `amount: number | null`.
 */
ContractModel.addHook('afterFind', (result) => {
  const rows = Array.isArray(result) ? result : result ? [result] : [];
  for (const row of rows as ContractModel[]) {
    if (row && row.amount != null) {
      row.amount = Number(row.amount);
    }
  }
});
