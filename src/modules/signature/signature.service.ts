import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors/app-error';
import {
  ContractStatus,
  SignatoryStatus,
  SignatureMode,
  SignatureRequestStatus,
  SignatureType,
  type AuthContext,
} from '../../shared/types';
import { recordAudit } from '../audit/audit.service';
import { publish } from '../../infrastructure/messaging/rabbitmq';
import {
  getSignature,
  getSignatureImageBase64,
  recordUsage,
} from '../../infrastructure/clients/signature.client';
import { findContractById } from '../contract/contract.repository';
import { transitionStatus, type RequestContext } from '../contract/contract.service';
import * as repo from './signature.repository';
import type {
  CreateSignatureRequestInput,
  RemindInput,
  SignInput,
} from './signature.validator';
import type {
  SignatoryModel,
  SignatureRequestModel,
} from '../../infrastructure/database/models';

export interface SignatureContext {
  auth: AuthContext;
  tenantSchoolId: string;
  ip: string | null;
  device: string | null;
  /** JWT brut de l'appelant, transmis au signature-service (schoolScope). */
  token: string | null;
}

function toRequestContext(ctx: SignatureContext): RequestContext {
  return { auth: ctx.auth, tenantSchoolId: ctx.tenantSchoolId, academicYearId: null, ip: ctx.ip };
}

function serializeSignatory(s: SignatoryModel) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    userId: s.user_id,
    order: s.order_index,
    status: s.status,
    signatureType: s.signature_type,
    signedAt: s.signed_at,
    ip: s.ip,
    device: s.device,
  };
}

function serializeRequest(r: SignatureRequestModel, signatories: SignatoryModel[]) {
  return {
    id: r.id,
    contractId: r.contract_id,
    mode: r.mode,
    status: r.status,
    deadline: r.deadline,
    externalRef: r.external_ref,
    createdBy: r.created_by,
    createdAt: r.created_at,
    signatories: signatories.map(serializeSignatory),
  };
}

/**
 * Cree une demande de signature pour un contrat. Le contrat doit etre APPROVED
 * (auquel cas il passe automatiquement en PENDING_SIGNATURE) ou deja
 * PENDING_SIGNATURE. Publie l'intention de notification (communication-core).
 */
export async function createSignatureRequest(
  contractId: string,
  input: CreateSignatureRequestInput,
  ctx: SignatureContext,
) {
  const contract = await findContractById(contractId);
  if (!contract) throw new NotFoundError('Contrat introuvable');

  if (contract.status === ContractStatus.APPROVED) {
    await transitionStatus(
      contractId,
      { toStatus: ContractStatus.PENDING_SIGNATURE, reason: 'Ouverture de la signature' },
      toRequestContext(ctx),
    );
  } else if (contract.status !== ContractStatus.PENDING_SIGNATURE) {
    throw new BusinessRuleError(
      `Signature impossible depuis le statut ${contract.status} (attendu: APPROVED ou PENDING_SIGNATURE)`,
    );
  }

  const request = await repo.createRequest({
    tenant_school_id: contract.tenant_school_id,
    contract_id: contractId,
    mode: input.mode,
    status: SignatureRequestStatus.PENDING,
    deadline: input.deadline ?? null,
    external_ref: null,
    created_by: ctx.auth.userId,
  });

  const signatories: SignatoryModel[] = [];
  let order = 0;
  for (const s of input.signatories) {
    signatories.push(
      await repo.createSignatory({
        tenant_school_id: contract.tenant_school_id,
        request_id: request.id,
        contract_id: contractId,
        order_index: s.order ?? order,
        user_id: s.userId ?? null,
        name: s.name,
        email: s.email,
        status: SignatoryStatus.PENDING,
        signature_type: null,
        signed_at: null,
        ip: null,
        device: null,
        signature_ref: null,
      }),
    );
    order += 1;
  }

  // NB: l'orchestration multi-signataires est locale a contrat-service; le
  // signature-service ne connait que des signatures reutilisables + usages.

  await recordAudit({
    tenantSchoolId: contract.tenant_school_id,
    entityType: 'signature_request',
    entityId: request.id,
    action: 'CREATE',
    actorUserId: ctx.auth.userId,
    payload: { contractId, mode: input.mode, signatories: signatories.length },
    ip: ctx.ip,
  });

  // Intention de notification (pas d'appel direct a communication-core en Phase 2).
  publish('contract.signature_requested', {
    event: 'contract.signature_requested',
    contractId,
    tenantSchoolId: contract.tenant_school_id,
    requestId: request.id,
    signatories: signatories.map((s) => ({ name: s.name, email: s.email })),
  });

  return serializeRequest(request, signatories);
}

/** Statut de signature d'un contrat (toutes les demandes + signataires). */
export async function getContractSignatures(contractId: string) {
  const contract = await findContractById(contractId);
  if (!contract) throw new NotFoundError('Contrat introuvable');
  const requests = await repo.listRequestsByContract(contractId);
  const out = [];
  for (const r of requests) {
    const signatories = await repo.listSignatories(r.id);
    out.push(serializeRequest(r, signatories));
  }
  return out;
}

/**
 * Appose la signature d'un signataire. En mode SEQUENTIAL, respecte l'ordre.
 * Quand tous ont signe: demande COMPLETED + contrat -> ACTIVE (+ contract.signed).
 */
export async function sign(requestId: string, input: SignInput, ctx: SignatureContext) {
  const request = await repo.findRequestById(requestId);
  if (!request) throw new NotFoundError('Demande de signature introuvable');
  if (request.status !== SignatureRequestStatus.PENDING) {
    throw new ConflictError(`La demande n'est plus active (statut ${request.status})`);
  }

  const signatory = await repo.findSignatory(requestId, input.signatoryId);
  if (!signatory) throw new NotFoundError('Signataire introuvable');
  if (signatory.status === SignatoryStatus.SIGNED) {
    throw new ConflictError('Ce signataire a deja signe');
  }

  const all = await repo.listSignatories(requestId);
  if (request.mode === SignatureMode.SEQUENTIAL) {
    const nextPending = all.find((s) => s.status === SignatoryStatus.PENDING);
    if (nextPending && nextPending.id !== signatory.id) {
      throw new ConflictError('Signature sequentielle: ce n\'est pas le tour de ce signataire');
    }
  }

  // Determination du type + reference de la signature.
  let signatureType: SignatureType;
  let signatureRef: string | null = null;
  let usageId: string | null = null;

  if (input.signatureId) {
    // Signature reutilisable du signature-service: on la valide, on trace l'usage.
    if (!ctx.token) {
      throw new BusinessRuleError('Jeton d\'authentification requis pour utiliser une signature du signature-service');
    }
    const remote = await getSignature(input.signatureId, ctx.token);
    if (!remote) {
      throw new BusinessRuleError('Signature introuvable dans le signature-service');
    }
    signatureType =
      remote.signatureType === 'DRAWN' ? SignatureType.DRAWN : SignatureType.TEXT;
    signatureRef = input.signatureId;
    // Apposition/paraphe: recuperation best-effort de l'image (pour un futur
    // embarquement dans le PDF) et journalisation de l'utilisation.
    await getSignatureImageBase64(input.signatureId, ctx.token);
    usageId = await recordUsage(
      {
        signatureId: input.signatureId,
        contractId: request.contract_id,
        signatoryId: signatory.id,
        signatoryName: signatory.name,
      },
      ctx.token,
    );
  } else {
    // Signature inline (signataire externe sans compte).
    signatureType = input.type as SignatureType;
  }

  signatory.status = SignatoryStatus.SIGNED;
  signatory.signature_type = signatureType;
  signatory.signed_at = new Date();
  signatory.ip = ctx.ip;
  signatory.device = ctx.device;
  signatory.signature_ref = signatureRef;
  await repo.saveSignatory(signatory);

  await recordAudit({
    tenantSchoolId: request.tenant_school_id,
    entityType: 'signatory',
    entityId: signatory.id,
    action: 'SIGN',
    actorUserId: ctx.auth.userId,
    payload: { requestId, type: signatureType, signatureId: signatureRef, usageId },
    ip: ctx.ip,
  });

  // Tous signes ?
  const refreshed = await repo.listSignatories(requestId);
  const allSigned = refreshed.every((s) => s.status === SignatoryStatus.SIGNED);
  if (allSigned) {
    request.status = SignatureRequestStatus.COMPLETED;
    await repo.saveRequest(request);
    // Transition automatique du contrat -> ACTIVE (publie contract.signed).
    await transitionStatus(
      request.contract_id,
      { toStatus: ContractStatus.ACTIVE, reason: 'Toutes les signatures recueillies' },
      toRequestContext(ctx),
    );
  }

  return { signatory: serializeSignatory(signatory), requestCompleted: allSigned };
}

/** Relance un signataire en attente (intention de notification). */
export async function remind(requestId: string, input: RemindInput, ctx: SignatureContext) {
  const request = await repo.findRequestById(requestId);
  if (!request) throw new NotFoundError('Demande de signature introuvable');
  const signatory = await repo.findSignatory(requestId, input.signatoryId);
  if (!signatory) throw new NotFoundError('Signataire introuvable');
  if (signatory.status !== SignatoryStatus.PENDING) {
    throw new ConflictError('Ce signataire n\'est pas en attente');
  }

  publish('contract.signature_reminder', {
    event: 'contract.signature_reminder',
    contractId: request.contract_id,
    tenantSchoolId: request.tenant_school_id,
    requestId,
    signatory: { name: signatory.name, email: signatory.email },
  });

  await recordAudit({
    tenantSchoolId: request.tenant_school_id,
    entityType: 'signatory',
    entityId: signatory.id,
    action: 'REMIND',
    actorUserId: ctx.auth.userId,
    payload: { requestId },
    ip: ctx.ip,
  });

  return { reminded: true };
}
