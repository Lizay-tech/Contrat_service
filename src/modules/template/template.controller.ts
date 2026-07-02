import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { sendCreated, sendData, sendPaginated } from '../../shared/http/response';
import type { AuthContext } from '../../shared/types';
import {
  createTemplateSchema,
  duplicateTemplateSchema,
  listTemplatesQuerySchema,
  previewTemplateSchema,
  updateTemplateSchema,
} from './template.validator';
import * as service from './template.service';
import type { TemplateContext } from './template.service';

function ctxOf(req: Request): TemplateContext {
  const auth = req.auth as AuthContext | undefined;
  if (!auth || !req.tenantSchoolId) throw new UnauthorizedError();
  return { auth, tenantSchoolId: req.tenantSchoolId, ip: req.ip ?? null };
}

export async function getTemplates(req: Request, res: Response): Promise<void> {
  const query = listTemplatesQuerySchema.parse(req.query);
  const { items, total, page, limit } = await service.listTemplates(query);
  sendPaginated(res, items, total, page, limit);
}

export async function getTemplateDetail(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getTemplate(req.params.id as string));
}

export async function getTemplateVersions(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getVersions(req.params.id as string));
}

export async function getTemplateVariables(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getVariables(req.params.id as string));
}

export async function postTemplate(req: Request, res: Response): Promise<void> {
  const input = createTemplateSchema.parse(req.body);
  sendCreated(res, await service.createTemplate(input, ctxOf(req)));
}

export async function patchTemplate(req: Request, res: Response): Promise<void> {
  const input = updateTemplateSchema.parse(req.body);
  sendData(res, await service.updateTemplate(req.params.id as string, input, ctxOf(req)));
}

export async function postDuplicate(req: Request, res: Response): Promise<void> {
  const { name } = duplicateTemplateSchema.parse(req.body ?? {});
  sendCreated(res, await service.duplicateTemplate(req.params.id as string, name, ctxOf(req)));
}

export async function postPublish(req: Request, res: Response): Promise<void> {
  sendData(res, await service.publishTemplate(req.params.id as string, ctxOf(req)));
}

export async function postArchive(req: Request, res: Response): Promise<void> {
  sendData(res, await service.archiveTemplate(req.params.id as string, ctxOf(req)));
}

export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  await service.deleteTemplate(req.params.id as string, ctxOf(req));
  res.status(204).send();
}

export async function postPreview(req: Request, res: Response): Promise<void> {
  const input = previewTemplateSchema.parse(req.body ?? {});
  const result = await service.previewTemplate(req.params.id as string, input);
  if (result.format === 'pdf' && result.pdf) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    res.status(200).send(result.pdf);
    return;
  }
  sendData(res, { html: result.html });
}
