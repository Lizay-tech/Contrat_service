import type { Request, Response } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { sendData } from '../../shared/http/response';
import { assembleRenderContext } from '../../domain/template/context';
import { findMissingRequired } from '../../domain/template/render';
import { resolveVariables } from '../../domain/template/variable-catalogue';
import { resolveRenderableVersion } from '../template/template.service';
import { aggregateContext, contextToVariables } from './aggregation.service';

const previewQuerySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    templateId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    schoolId: z.string().uuid().optional(),
  })
  .refine((q) => q.employeeId || q.templateId, {
    message: 'employeeId ou templateId requis',
  });

/**
 * GET /contracts/aggregate/preview
 * Assemble le ContractContext depuis les services disponibles et resout les
 * variables du template (pour pre-remplir le formulaire cote front).
 */
export async function getAggregatePreview(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new UnauthorizedError();
  const query = previewQuerySchema.parse(req.query);
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;

  const context = await aggregateContext({
    employeeId: query.employeeId ?? null,
    assignmentId: query.assignmentId ?? null,
    schoolId: query.schoolId ?? null,
    token,
  });
  const variables = contextToVariables(context);

  let templateInfo:
    | {
        templateId: string;
        version: number;
        catalogue: ReturnType<typeof resolveVariables>;
        resolvedVariables: Record<string, unknown>;
        missingRequired: Array<{ key: string; label: string }>;
      }
    | undefined;

  if (query.templateId) {
    const { version } = await resolveRenderableVersion(query.templateId);
    const resolved = assembleRenderContext(variables, {});
    templateInfo = {
      templateId: query.templateId,
      version: version.version,
      catalogue: resolveVariables(version.body),
      resolvedVariables: resolved,
      missingRequired: findMissingRequired(version.body, resolved),
    };
  }

  sendData(res, {
    context,
    variables,
    missingSources: context.missingSources,
    warnings: context.warnings,
    template: templateInfo,
  });
}
