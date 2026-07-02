import { z } from 'zod';
import {
  ContractScope,
  ContractStatus,
  DocumentType,
  PartyType,
  RenewalMode,
  RoleInContract,
} from '../../shared/types';

const uuid = z.string().uuid();
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu YYYY-MM-DD');

/**
 * NB: aucun champ schoolId/tenant n'est accepte ici. Le tenant provient
 * EXCLUSIVEMENT du JWT; toute valeur passee dans le body est ignoree.
 */
export const createContractSchema = z.object({
  contractTypeId: uuid,
  title: z.string().min(3).max(255),
  subjectSchoolId: uuid.optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  durationDays: z.number().int().positive().optional(),
  trialPeriodDays: z.number().int().nonnegative().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  renewalMode: z.nativeEnum(RenewalMode).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z
  .object({
    title: z.string().min(3).max(255).optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    durationDays: z.number().int().positive().nullable().optional(),
    trialPeriodDays: z.number().int().nonnegative().nullable().optional(),
    amount: z.number().nonnegative().nullable().optional(),
    currency: z.string().length(3).optional(),
    renewalMode: z.nativeEnum(RenewalMode).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Aucun champ a mettre a jour',
  });
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const transitionSchema = z.object({
  toStatus: z.nativeEnum(ContractStatus),
  reason: z.string().max(2000).optional(),
});
export type TransitionInput = z.infer<typeof transitionSchema>;

export const addPartySchema = z.object({
  partyType: z.nativeEnum(PartyType),
  personUserId: uuid.optional(),
  schoolId: uuid.optional(),
  roleInContract: z.nativeEnum(RoleInContract),
  fullName: z.string().min(2).max(255),
  email: z.string().email().max(255).optional(),
});
export type AddPartyInput = z.infer<typeof addPartySchema>;

export const uploadDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType).optional(),
});

export const fromTemplateSchema = z.object({
  templateId: uuid,
  variables: z.record(z.unknown()).default({}),
  parties: z.array(addPartySchema).default([]),
  title: z.string().min(3).max(255).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  durationDays: z.number().int().positive().optional(),
  trialPeriodDays: z.number().int().nonnegative().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  renewalMode: z.nativeEnum(RenewalMode).optional(),
  subjectSchoolId: uuid.optional(),
  city: z.string().max(128).optional(),
});
export type FromTemplateInput = z.infer<typeof fromTemplateSchema>;

export const listContractsQuerySchema = z.object({
  status: z.nativeEnum(ContractStatus).optional(),
  contractTypeId: uuid.optional(),
  scope: z.nativeEnum(ContractScope).optional(),
  subjectSchoolId: uuid.optional(),
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
