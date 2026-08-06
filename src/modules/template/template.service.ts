import { env } from '../../shared/config/env';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/app-error';
import {
  TemplateScopeOwner,
  TemplateStatus,
  type AuthContext,
} from '../../shared/types';
import { resolveVariables } from '../../domain/template/variable-catalogue';
import { assembleRenderContext } from '../../domain/template/context';
import { renderTemplate } from '../../domain/template/render';
import { htmlToPdf } from '../../infrastructure/pdf/html-pdf';
import { recordAudit } from '../audit/audit.service';
import * as repo from './template.repository';
import { serializeTemplate, serializeVersion } from './template.serializer';
import type {
  CreateTemplateInput,
  ListTemplatesQuery,
  PreviewTemplateInput,
  UpdateTemplateInput,
} from './template.validator';
import type {
  ContractTemplateModel,
  TemplateVersionModel,
} from '../../infrastructure/database/models';

const ENTITY = 'contract_template';

export interface TemplateContext {
  auth: AuthContext;
  tenantSchoolId: string;
  ip: string | null;
}

/** Un modele PREDEFINED n'est jamais modifiable par une ecole. */
function assertWritable(template: ContractTemplateModel, ctx: TemplateContext): void {
  if (template.scope_owner === TemplateScopeOwner.PREDEFINED && !isEducaAdmin(ctx.auth.roleCode)) {
    throw new ForbiddenError('Un modele predefini n\'est pas modifiable (clonez-le d\'abord)');
  }
}

function isEducaAdmin(roleCode: string): boolean {
  return env.educaAdminRoles.includes(roleCode);
}

export async function listTemplates(query: ListTemplatesQuery) {
  const { rows, count } = await repo.listTemplates(query);
  return {
    items: rows.map(serializeTemplate),
    total: count,
    page: query.page,
    limit: query.limit,
  };
}

async function getTemplateOrThrow(id: string): Promise<ContractTemplateModel> {
  const t = await repo.findTemplateById(id);
  if (!t) throw new NotFoundError('Modele introuvable');
  return t;
}

export async function getTemplate(id: string) {
  const t = await repo.findTemplateWithVersions(id);
  if (!t) throw new NotFoundError('Modele introuvable');
  return serializeTemplate(t);
}

export async function getVersions(id: string) {
  await getTemplateOrThrow(id);
  const versions = await repo.listVersions(id);
  return versions.map(serializeVersion);
}

/** Variables detectees dans la derniere version (fallback: corps courant). */
export async function getVariables(id: string) {
  await getTemplateOrThrow(id);
  const latest = await repo.findLatestVersion(id);
  if (!latest) return [];
  return latest.variables?.length ? latest.variables : resolveVariables(latest.body);
}

/** Creation d'un modele SCHOOL (version 1 en brouillon). */
export async function createTemplate(input: CreateTemplateInput, ctx: TemplateContext) {
  const template = await repo.createTemplate({
    tenant_school_id: ctx.tenantSchoolId,
    scope_owner: TemplateScopeOwner.SCHOOL,
    contract_type_id: input.contractTypeId ?? null,
    name: input.name,
    description: input.description ?? null,
    status: TemplateStatus.DRAFT,
    current_version: 0,
    created_by: ctx.auth.userId,
  });

  await repo.createVersion({
    tenant_school_id: ctx.tenantSchoolId,
    is_predefined: false,
    template_id: template.id,
    version: 1,
    body: input.body,
    header: input.header ?? null,
    footer: input.footer ?? null,
    variables: resolveVariables(input.body),
    changelog: input.changelog ?? 'Version initiale',
    published_at: null,
  });

  await recordAudit({
    tenantSchoolId: ctx.tenantSchoolId,
    entityType: ENTITY,
    entityId: template.id,
    action: 'CREATE',
    actorUserId: ctx.auth.userId,
    payload: { name: input.name },
    ip: ctx.ip,
  });

  return getTemplate(template.id);
}

/** Mise a jour: metadonnees + (si body fourni) creation d'une nouvelle version brouillon. */
export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  ctx: TemplateContext,
) {
  const template = await getTemplateOrThrow(id);
  assertWritable(template, ctx);

  if (input.name !== undefined) template.name = input.name;
  if (input.description !== undefined) template.description = input.description;
  if (input.contractTypeId !== undefined) template.contract_type_id = input.contractTypeId;

  if (input.body !== undefined) {
    const latest = await repo.findLatestVersion(id);
    const nextVersion = (latest?.version ?? 0) + 1;
    await repo.createVersion({
      tenant_school_id: template.tenant_school_id,
      is_predefined: template.scope_owner === TemplateScopeOwner.PREDEFINED,
      template_id: id,
      version: nextVersion,
      body: input.body,
      header: input.header ?? null,
      footer: input.footer ?? null,
      variables: resolveVariables(input.body),
      changelog: input.changelog ?? `Revision ${nextVersion}`,
      published_at: null,
    });
    if (template.status === TemplateStatus.ARCHIVED) template.status = TemplateStatus.DRAFT;
  }

  await repo.saveTemplate(template);
  await recordAudit({
    tenantSchoolId: template.tenant_school_id ?? ctx.tenantSchoolId,
    entityType: ENTITY,
    entityId: id,
    action: 'UPDATE',
    actorUserId: ctx.auth.userId,
    payload: { fields: Object.keys(input) },
    ip: ctx.ip,
  });
  return getTemplate(id);
}

/** Clonage d'un modele (PREDEFINED ou SCHOOL) vers un modele SCHOOL editable. */
export async function duplicateTemplate(id: string, name: string | undefined, ctx: TemplateContext) {
  const source = await repo.findTemplateById(id);
  if (!source) throw new NotFoundError('Modele source introuvable');
  const sourceVersion =
    (await currentPublishedOrLatest(source)) ??
    (() => {
      throw new ConflictError('Le modele source n\'a aucune version');
    })();

  const clone = await repo.createTemplate({
    tenant_school_id: ctx.tenantSchoolId,
    scope_owner: TemplateScopeOwner.SCHOOL,
    contract_type_id: source.contract_type_id,
    name: name ?? `${source.name} (copie)`,
    description: source.description,
    status: TemplateStatus.DRAFT,
    current_version: 0,
    created_by: ctx.auth.userId,
  });

  await repo.createVersion({
    tenant_school_id: ctx.tenantSchoolId,
    is_predefined: false,
    template_id: clone.id,
    version: 1,
    body: sourceVersion.body,
    header: sourceVersion.header,
    footer: sourceVersion.footer,
    variables: sourceVersion.variables ?? resolveVariables(sourceVersion.body),
    changelog: `Clone de ${source.name}`,
    published_at: null,
  });

  await recordAudit({
    tenantSchoolId: ctx.tenantSchoolId,
    entityType: ENTITY,
    entityId: clone.id,
    action: 'DUPLICATE',
    actorUserId: ctx.auth.userId,
    payload: { sourceTemplateId: id },
    ip: ctx.ip,
  });
  return getTemplate(clone.id);
}

/** Publie la derniere version (fige le corps) et passe le modele en PUBLISHED. */
export async function publishTemplate(id: string, ctx: TemplateContext) {
  const template = await getTemplateOrThrow(id);
  assertWritable(template, ctx);
  const latest = await repo.findLatestVersion(id);
  if (!latest) throw new ConflictError('Aucune version a publier');

  if (!latest.published_at) {
    latest.published_at = new Date();
    await repo.saveVersion(latest);
  }
  template.status = TemplateStatus.PUBLISHED;
  template.current_version = latest.version;
  await repo.saveTemplate(template);

  await recordAudit({
    tenantSchoolId: template.tenant_school_id ?? ctx.tenantSchoolId,
    entityType: ENTITY,
    entityId: id,
    action: 'PUBLISH',
    actorUserId: ctx.auth.userId,
    payload: { version: latest.version },
    ip: ctx.ip,
  });
  return getTemplate(id);
}

export async function archiveTemplate(id: string, ctx: TemplateContext) {
  const template = await getTemplateOrThrow(id);
  assertWritable(template, ctx);
  template.status = TemplateStatus.ARCHIVED;
  await repo.saveTemplate(template);
  await recordAudit({
    tenantSchoolId: template.tenant_school_id ?? ctx.tenantSchoolId,
    entityType: ENTITY,
    entityId: id,
    action: 'ARCHIVE',
    actorUserId: ctx.auth.userId,
    ip: ctx.ip,
  });
  return getTemplate(id);
}

/** Suppression logique, interdite si des contrats utilisent le modele. */
export async function deleteTemplate(id: string, ctx: TemplateContext): Promise<void> {
  const template = await getTemplateOrThrow(id);
  assertWritable(template, ctx);
  const used = await repo.countContractsUsingTemplate(id);
  if (used > 0) {
    throw new ConflictError(`Suppression impossible: ${used} contrat(s) utilisent ce modele`);
  }
  await repo.softDeleteTemplate(template);
  await recordAudit({
    tenantSchoolId: template.tenant_school_id ?? ctx.tenantSchoolId,
    entityType: ENTITY,
    entityId: id,
    action: 'DELETE',
    actorUserId: ctx.auth.userId,
    ip: ctx.ip,
  });
}

/** Version publiee courante, sinon derniere version disponible. */
async function currentPublishedOrLatest(
  template: ContractTemplateModel,
): Promise<TemplateVersionModel | null> {
  if (template.current_version > 0) {
    const published = await repo.findVersion(template.id, template.current_version);
    if (published) return published;
  }
  return repo.findLatestVersion(template.id);
}

export interface PreviewResult {
  format: 'html' | 'pdf';
  html?: string;
  pdf?: Buffer;
}

/** Previsualisation rendue avec des donnees d'exemple. */
export async function previewTemplate(
  id: string,
  input: PreviewTemplateInput,
): Promise<PreviewResult> {
  const template = await getTemplateOrThrow(id);
  const version = await currentPublishedOrLatest(template);
  if (!version) throw new ConflictError('Aucune version a previsualiser');

  const context = assembleRenderContext(input.sampleData ?? {}, {
    contractTitle: template.name,
  });
  const html = renderTemplate(version.body, context);

  if (input.format === 'pdf') {
    const pdf = await htmlToPdf(html, { header: version.header, footer: version.footer });
    return { format: 'pdf', pdf };
  }
  return { format: 'html', html };
}

/** Utilitaire reutilise par le module contract pour rendre un corps. */
export async function resolveRenderableVersion(templateId: string) {
  const template = await getTemplateOrThrow(templateId);
  const version = await currentPublishedOrLatest(template);
  if (!version) throw new ValidationError('Le modele choisi n\'a aucune version');
  return { template, version };
}
