import type {
  ContractTemplateModel,
  TemplateVersionModel,
} from '../../infrastructure/database/models';

export function serializeVersion(v: TemplateVersionModel) {
  return {
    id: v.id,
    version: v.version,
    isPredefined: v.is_predefined,
    body: v.body,
    header: v.header,
    footer: v.footer,
    variables: v.variables,
    changelog: v.changelog,
    publishedAt: v.published_at,
    createdAt: v.created_at,
  };
}

export function serializeTemplate(t: ContractTemplateModel) {
  const withRel = t as ContractTemplateModel & { versions?: TemplateVersionModel[] };
  return {
    id: t.id,
    tenantSchoolId: t.tenant_school_id,
    scopeOwner: t.scope_owner,
    contractTypeId: t.contract_type_id,
    name: t.name,
    description: t.description,
    status: t.status,
    currentVersion: t.current_version,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    versions: withRel.versions?.map(serializeVersion),
  };
}
