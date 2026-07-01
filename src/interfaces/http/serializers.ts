import { Contract } from '../../domain/contract/Contract';
import {
  AuditLogRecord,
  DocumentRecord,
  PartyRecord,
  StatusHistoryRecord,
} from '../../application/ports/repositories';

function isoDateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function serializeContract(c: Contract): Record<string, unknown> {
  const p = c.toJSON();
  return {
    id: p.id,
    tenantSchoolId: p.tenantSchoolId,
    subjectSchoolId: p.subjectSchoolId,
    anneeScolaireId: p.anneeScolaireId,
    contractNumber: p.contractNumber,
    contractTypeId: p.contractTypeId,
    scope: p.scope,
    status: p.status,
    startDate: isoDateOnly(p.startDate),
    endDate: isoDateOnly(p.endDate),
    durationDays: p.durationDays,
    trialPeriodDays: p.trialPeriodDays,
    amount: p.amount,
    currency: p.currency,
    renewalMode: p.renewalMode,
    ownerUserId: p.ownerUserId,
    title: p.title,
    metadata: p.metadata,
    createdAt: p.createdAt ?? null,
    updatedAt: p.updatedAt ?? null,
  };
}

export function serializeParty(p: PartyRecord): Record<string, unknown> {
  return {
    id: p.id,
    contractId: p.contractId,
    partyType: p.partyType,
    personUserId: p.personUserId,
    schoolId: p.schoolId,
    roleInContract: p.roleInContract,
    fullName: p.fullName,
    email: p.email,
    createdAt: p.createdAt,
  };
}

export function serializeDocument(d: DocumentRecord): Record<string, unknown> {
  return {
    id: d.id,
    contractId: d.contractId,
    type: d.type,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    sha256Hash: d.sha256Hash,
    version: d.version,
    uploadedBy: d.uploadedBy,
    createdAt: d.createdAt,
  };
}

export function serializeStatusHistory(
  h: StatusHistoryRecord,
): Record<string, unknown> {
  return {
    id: h.id,
    contractId: h.contractId,
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    changedBy: h.changedBy,
    reason: h.reason,
    changedAt: h.changedAt,
  };
}

export function serializeAudit(a: AuditLogRecord): Record<string, unknown> {
  return {
    id: a.id,
    entityType: a.entityType,
    entityId: a.entityId,
    action: a.action,
    actorUserId: a.actorUserId,
    payload: a.payload,
    createdAt: a.createdAt,
  };
}
