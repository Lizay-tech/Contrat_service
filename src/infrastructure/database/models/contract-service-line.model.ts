import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';
import { ServiceLineStatus, enumValues } from '../../../shared/types';

/**
 * Service couvert par un contrat d'abonnement.
 *
 * Les lignes sont VERSIONNEES plutot que modifiees en place : `from_version`
 * porte la version qui a introduit la ligne, `to_version` celle qui l'a
 * retiree (NULL tant qu'elle est en vigueur). Une suppression physique
 * rendrait illisible une version anterieure deja signee — ce qui est
 * precisement ce qu'un contrat ne peut pas se permettre.
 *
 * Aucune cle etrangere vers service-management-service : c'est un autre
 * service, avec sa propre base. `service_id` et `school_service_id` sont des
 * correspondances, pas des references contraintes.
 */
export class ContractServiceLineModel extends Model<
  InferAttributes<ContractServiceLineModel>,
  InferCreationAttributes<ContractServiceLineModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare contract_id: string;
  declare from_version: CreationOptional<number>;
  /** `null` = ligne encore en vigueur dans la version courante. */
  declare to_version: number | null;
  declare school_service_id: string | null;
  declare service_id: string;
  declare service_code: string;
  declare service_name: string;
  declare description: string | null;
  declare status: CreationOptional<ServiceLineStatus>;
  /** Tarif applique a l'etablissement : surcharge negociee, sinon catalogue. */
  declare unit_price: number | null;
  declare currency: CreationOptional<string>;
  declare quantity: CreationOptional<number>;
  declare billing_type: string | null;
  declare duration_days: number | null;
  declare activation_date: Date | null;
  declare expiration_date: Date | null;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

ContractServiceLineModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    contract_id: { type: DataTypes.UUID, allowNull: false },
    from_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    to_version: { type: DataTypes.INTEGER, allowNull: true },
    school_service_id: { type: DataTypes.UUID, allowNull: true },
    service_id: { type: DataTypes.UUID, allowNull: false },
    service_code: { type: DataTypes.STRING(64), allowNull: false },
    service_name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM(...enumValues.ServiceLineStatus),
      allowNull: false,
      defaultValue: ServiceLineStatus.PENDING,
    },
    // NUMERIC est rendu en chaine par le pilote pg pour ne pas perdre de
    // precision ; le getter normalise en nombre une bonne fois pour toutes.
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      get(): number | null {
        const raw = this.getDataValue('unit_price');
        return raw === null || raw === undefined ? null : Number(raw);
      },
    },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'HTG' },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    billing_type: { type: DataTypes.STRING(16), allowNull: true },
    duration_days: { type: DataTypes.INTEGER, allowNull: true },
    activation_date: { type: DataTypes.DATE, allowNull: true },
    expiration_date: { type: DataTypes.DATE, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'contract_service_lines',
    modelName: 'ContractServiceLine',
    indexes: [
      { name: 'service_lines_tenant_contract_idx', fields: ['tenant_school_id', 'contract_id'] },
    ],
  },
);
