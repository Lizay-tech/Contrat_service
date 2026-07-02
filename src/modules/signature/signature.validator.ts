import { z } from 'zod';
import { SignatureMode, SignatureType } from '../../shared/types';

const uuid = z.string().uuid();

export const createSignatureRequestSchema = z.object({
  mode: z.nativeEnum(SignatureMode).default(SignatureMode.PARALLEL),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu YYYY-MM-DD')
    .optional(),
  signatories: z
    .array(
      z.object({
        userId: uuid.optional(),
        name: z.string().min(2).max(255),
        email: z.string().email().max(255),
        order: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1, 'Au moins un signataire'),
});
export type CreateSignatureRequestInput = z.infer<typeof createSignatureRequestSchema>;

export const signSchema = z
  .object({
    signatoryId: uuid,
    // Reference a une signature du signature-service (paraphe reutilisable)...
    signatureId: uuid.optional(),
    // ...ou signature inline (signataire externe sans compte).
    type: z.nativeEnum(SignatureType).optional(),
    data: z.string().min(1).optional(),
  })
  .refine((o) => o.signatureId || (o.type && o.data), {
    message: 'Fournir signatureId (signature-service) ou (type + data) pour une signature inline',
  });
export type SignInput = z.infer<typeof signSchema>;

export const remindSchema = z.object({
  signatoryId: uuid,
});
export type RemindInput = z.infer<typeof remindSchema>;
