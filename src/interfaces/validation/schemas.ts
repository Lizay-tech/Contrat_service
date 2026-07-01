import { z } from 'zod';
import {
  ContractScope,
  ContractStatus,
  DocumentType,
  PartyType,
  RenewalMode,
  RoleInContract,
} from '../../domain/enums';

// A YYYY-MM-DD date string -> Date, or null.
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD')
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Expected a decimal amount');

/**
 * NOTE: schoolId / tenant is NEVER accepted from the client. `subjectSchoolId`
 * is the ONLY school id in the payload and applies to ETABLISSEMENT contracts.
 */
export const createContractSchema = z.object({
  contractTypeId: z.string().uuid(),
  title: z.string().min(1).max(255),
  subjectSchoolId: z.string().uuid().nullable().optional(),
  startDate: dateOnly.nullable().optional(),
  endDate: dateOnly.nullable().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  trialPeriodDays: z.number().int().nonnegative().nullable().optional(),
  amount: decimalString.nullable().optional(),
  currency: z.string().length(3).optional(),
  renewalMode: z.nativeEnum(RenewalMode).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateContractBody = z.infer<typeof createContractSchema>;

export const updateContractSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    startDate: dateOnly.nullable().optional(),
    endDate: dateOnly.nullable().optional(),
    durationDays: z.number().int().positive().nullable().optional(),
    trialPeriodDays: z.number().int().nonnegative().nullable().optional(),
    amount: decimalString.nullable().optional(),
    currency: z.string().length(3).optional(),
    renewalMode: z.nativeEnum(RenewalMode).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  });

export const transitionSchema = z.object({
  toStatus: z.nativeEnum(ContractStatus),
  reason: z.string().max(2000).nullable().optional(),
});

export const addPartySchema = z.object({
  partyType: z.nativeEnum(PartyType),
  roleInContract: z.nativeEnum(RoleInContract),
  fullName: z.string().min(1).max(255),
  email: z.string().email().nullable().optional(),
  personUserId: z.string().uuid().nullable().optional(),
  schoolId: z.string().uuid().nullable().optional(),
});

export const uploadDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType).optional(),
});

export const listContractsQuerySchema = z.object({
  status: z.nativeEnum(ContractStatus).optional(),
  contractTypeId: z.string().uuid().optional(),
  scope: z.nativeEnum(ContractScope).optional(),
  subjectSchoolId: z.string().uuid().optional(),
  startDateFrom: dateOnly.optional(),
  startDateTo: dateOnly.optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
