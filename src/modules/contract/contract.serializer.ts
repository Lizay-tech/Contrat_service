import type {
  ContractDocumentModel,
  ContractModel,
  ContractPartyModel,
  ContractStatusHistoryModel,
} from '../../infrastructure/database/models';

export function serializeParty(p: ContractPartyModel) {
  return {
    id: p.id,
    partyType: p.party_type,
    roleInContract: p.role_in_contract,
    personUserId: p.person_user_id,
    schoolId: p.school_id,
    fullName: p.full_name,
    email: p.email,
  };
}

export function serializeDocument(d: ContractDocumentModel) {
  return {
    id: d.id,
    type: d.type,
    originalName: d.original_name,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    sha256: d.sha256_hash,
    version: d.version,
    uploadedBy: d.uploaded_by,
    createdAt: d.created_at,
  };
}

export function serializeStatusHistory(h: ContractStatusHistoryModel) {
  return {
    id: h.id,
    fromStatus: h.from_status,
    toStatus: h.to_status,
    changedBy: h.changed_by,
    reason: h.reason,
    changedAt: h.changed_at,
  };
}

export function serializeContract(c: ContractModel) {
  const withRel = c as ContractModel & {
    contractType?: { code: string; label: string; scope: string };
    parties?: ContractPartyModel[];
    documents?: ContractDocumentModel[];
    statusHistory?: ContractStatusHistoryModel[];
  };
  return {
    id: c.id,
    contractNumber: c.contract_number,
    title: c.title,
    status: c.status,
    tenantSchoolId: c.tenant_school_id,
    subjectSchoolId: c.subject_school_id,
    anneeScolaireId: c.annee_scolaire_id,
    contractTypeId: c.contract_type_id,
    contractType: withRel.contractType
      ? {
          code: withRel.contractType.code,
          label: withRel.contractType.label,
          scope: withRel.contractType.scope,
        }
      : undefined,
    startDate: c.start_date,
    endDate: c.end_date,
    durationDays: c.duration_days,
    trialPeriodDays: c.trial_period_days,
    amount: c.amount,
    currency: c.currency,
    renewalMode: c.renewal_mode,
    ownerUserId: c.owner_user_id,
    templateId: c.template_id,
    templateVersion: c.template_version,
    renderedBody: c.rendered_body,
    metadata: c.metadata,
    parties: withRel.parties?.map(serializeParty),
    documents: withRel.documents?.map(serializeDocument),
    statusHistory: withRel.statusHistory?.map(serializeStatusHistory),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}
