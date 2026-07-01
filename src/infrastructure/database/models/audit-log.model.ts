import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../sequelize';

/**
 * Journal d'audit IMMUABLE (append-only). Aucune mise a jour ni suppression:
 * pas de updated_at/deleted_at, et la migration revoque UPDATE/DELETE via RLS.
 */
export class AuditLogModel extends Model<
  InferAttributes<AuditLogModel>,
  InferCreationAttributes<AuditLogModel>
> {
  declare id: CreationOptional<string>;
  declare tenant_school_id: string;
  declare entity_type: string;
  declare entity_id: string;
  declare action: string;
  declare actor_user_id: string | null;
  declare payload: CreationOptional<Record<string, unknown>>;
  declare ip: string | null;
  declare created_at: CreationOptional<Date>;
}

AuditLogModel.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_school_id: { type: DataTypes.UUID, allowNull: false },
    entity_type: { type: DataTypes.STRING(128), allowNull: false },
    entity_id: { type: DataTypes.UUID, allowNull: false },
    action: { type: DataTypes.STRING(128), allowNull: false },
    actor_user_id: { type: DataTypes.UUID, allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ip: { type: DataTypes.STRING(64), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    modelName: 'AuditLog',
    timestamps: false,
    paranoid: false,
    indexes: [
      { name: 'audit_tenant_entity_idx', fields: ['tenant_school_id', 'entity_type', 'entity_id'] },
      { name: 'audit_tenant_created_idx', fields: ['tenant_school_id', 'created_at'] },
    ],
  },
);
