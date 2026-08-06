import { AuditLogModel } from '../../infrastructure/database/models';
import { currentTransaction } from '../../infrastructure/database/tenant-context';

export interface AuditEntry {
  tenantSchoolId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Ecrit une entree d'audit IMMUABLE. Participe a la transaction courante (RLS)
 * pour rester coherente avec l'ecriture metier associee.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await AuditLogModel.create(
    {
      tenant_school_id: entry.tenantSchoolId,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      actor_user_id: entry.actorUserId ?? null,
      payload: entry.payload ?? {},
      ip: entry.ip ?? null,
    },
    { transaction: currentTransaction() },
  );
}

/** Liste l'audit d'une entite (le filtre tenant est garanti par la RLS). */
export async function listAuditForEntity(
  entityType: string,
  entityId: string,
): Promise<AuditLogModel[]> {
  return AuditLogModel.findAll({
    where: { entity_type: entityType, entity_id: entityId },
    order: [['created_at', 'DESC']],
    transaction: currentTransaction(),
  });
}
