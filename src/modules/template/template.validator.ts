import { z } from 'zod';
import { TemplateScopeOwner, TemplateStatus } from '../../shared/types';

const uuid = z.string().uuid();

export const listTemplatesQuerySchema = z.object({
  scopeOwner: z.nativeEnum(TemplateScopeOwner).optional(),
  contractTypeId: uuid.optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

export const createTemplateSchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().max(2000).optional(),
  contractTypeId: uuid.optional(),
  body: z.string().min(1),
  header: z.string().optional(),
  footer: z.string().optional(),
  changelog: z.string().max(2000).optional(),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z
  .object({
    name: z.string().min(3).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    contractTypeId: uuid.nullable().optional(),
    // Fournir body cree une NOUVELLE version brouillon (versionnement).
    body: z.string().min(1).optional(),
    header: z.string().nullable().optional(),
    footer: z.string().nullable().optional(),
    changelog: z.string().max(2000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Aucun champ a mettre a jour' });
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const duplicateTemplateSchema = z.object({
  name: z.string().min(3).max(255).optional(),
});

export const previewTemplateSchema = z.object({
  sampleData: z.record(z.unknown()).optional(),
  format: z.enum(['html', 'pdf']).default('html'),
});
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
