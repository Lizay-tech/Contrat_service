import {
  BusinessRuleError,
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/app-error';
import {
  ContractStatus,
  DocumentType,
  SignatoryStatus,
  SignatureMode,
  SignatureRequestStatus,
  SignatureType,
  type AuthContext,
} from '../../shared/types';
import { recordAudit } from '../audit/audit.service';
import { publish } from '../../infrastructure/messaging/rabbitmq';
import {
  getDefaultSignature,
  getSignature,
  getSignatureImage,
  listUserSignatures,
  recordUsage,
  SignatureServiceError,
  type RemoteSignature,
} from '../../infrastructure/clients/signature.client';
import {
  htmlToPdfWithSignatures,
  type SignatureBlock,
} from '../../infrastructure/pdf/html-pdf';
import { formatDateFr } from '../../domain/template/render';
import { findContractById } from '../contract/contract.repository';
import { transitionStatus, type RequestContext } from '../contract/contract.service';
import { attachGeneratedPdf } from '../document/document.service';
import * as repo from './signature.repository';
import type {
  CreateSignatureRequestInput,
  RemindInput,
  SignInput,
} from './signature.validator';
import type {
  ContractModel,
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
    // Paraphe REELLEMENT appose: data URL image (DRAWN) ou texte (TEXT).
    //
    // Il etait persiste depuis la migration 0005 mais jamais renvoye, si bien
    // qu'aucune console ne pouvait MONTRER une signature. Le corps publie
    // (rendered_body) est fige avant toute signature: sa case de paraphe reste
    // vide a jamais. Les deux Parties ne voyaient donc jamais la signature de
    // l'autre, ni meme la leur, hors du PDF signe.
    //
    // Portee: null tant que le signataire n'a pas signe, et lisible seulement
    // par qui peut deja lire le contrat et ses signataires -- c'est-a-dire les
    // Parties elles-memes, a qui le document signe est du.
    signatureRender: s.signature_render,
    signedDocumentId: s.signed_document_id,
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

function toSignatureType(remote: RemoteSignature): SignatureType {
  return remote.signature_type === 'DRAWN' ? SignatureType.DRAWN : SignatureType.TEXT;
}

/**
 * Signatures de l'utilisateur courant disponibles pour ce contrat (via le
 * signature-service), avec le flag "par defaut".
 */
export async function getAvailableSignatures(contractId: string, ctx: SignatureContext) {
  if (!ctx.token) throw new UnauthorizedError();
  const contract = await findContractById(contractId);
  if (!contract) throw new NotFoundError('Contrat introuvable');

  try {
    const signatures = await listUserSignatures(ctx.token, contract.annee_scolaire_id);
    return signatures.map((s) => ({
      id: s.id,
      displayName: s.display_name ?? null,
      type: s.signature_type ?? null,
      status: s.status ?? null,
      isDefault: s.is_default === true,
    }));
  } catch (err) {
    if (err instanceof SignatureServiceError) throw new ExternalServiceError(err.message);
    throw err;
  }
}

/** Construit un corps HTML minimal si le contrat n'a pas de rendered_body. */
function fallbackBody(contract: ContractModel): string {
  return (
    `<h1>${contract.title}</h1>` +
    `<p>Contrat ${contract.contract_number}` +
    (contract.start_date ? ` a compter du ${formatDateFr(contract.start_date)}` : '') +
    `.</p>`
  );
}

/** Bloc d'apposition pour un signataire deja signe (rendu persiste). */
function blockFor(s: SignatoryModel): SignatureBlock {
  return {
    name: s.name,
    role: s.email,
    date: s.signed_at ? formatDateFr(s.signed_at) : '',
    type: s.signature_type ?? SignatureType.TEXT,
    render: s.signature_render,
  };
}

/**
 * Signe un contrat avec la signature choisie (ou par defaut) de l'utilisateur.
 * Confirmation obligatoire. Appose la signature sur le PDF (nouveau document
 * SIGNE), persiste, journalise l'usage cote 8093, et bascule ACTIVE au complet.
 *
 * Tout se deroule dans la transaction du tenantHandler: si l'apposition PDF ou la
 * persistance echoue, le signataire N'EST PAS marque signe (rollback).
 */
export async function sign(requestId: string, input: SignInput, ctx: SignatureContext) {
  const request = await repo.findRequestById(requestId);
  if (!request) throw new NotFoundError('Demande de signature introuvable');
  if (request.status !== SignatureRequestStatus.PENDING) {
    throw new ConflictError(`La demande n'est plus active (statut ${request.status})`);
  }

  // Confirmation explicite obligatoire.
  if (input.confirmed !== true) {
    throw new BusinessRuleError('Confirmation requise pour signer');
  }
  if (!ctx.token) throw new UnauthorizedError();

  const signatory = await repo.findSignatory(requestId, input.signatoryId);
  if (!signatory) throw new NotFoundError('Signataire introuvable');
  if (signatory.status === SignatoryStatus.SIGNED) {
    throw new ConflictError('Ce signataire a deja signe');
  }
  // Anti-usurpation: si le signataire est rattache a un compte, ce doit etre le signataire.
  if (signatory.user_id && signatory.user_id !== ctx.auth.userId) {
    throw new ForbiddenError('Vous ne pouvez pas signer a la place d\'un autre signataire');
  }

  const all = await repo.listSignatories(requestId);
  if (request.mode === SignatureMode.SEQUENTIAL) {
    const nextPending = all.find((s) => s.status === SignatoryStatus.PENDING);
    if (nextPending && nextPending.id !== signatory.id) {
      throw new ConflictError('Signature sequentielle: ce n\'est pas le tour de ce signataire');
    }
  }

  const contract = await findContractById(request.contract_id);
  if (!contract) throw new NotFoundError('Contrat introuvable');
  const academicYearId = contract.annee_scolaire_id;

  // 1) Resoudre la signature a utiliser (choisie ou par defaut).
  let remote: RemoteSignature | null;
  try {
    remote = input.signatureId
      ? await getSignature(input.signatureId, ctx.token, academicYearId)
      : await getDefaultSignature(ctx.token, academicYearId);
  } catch (err) {
    if (err instanceof SignatureServiceError) throw new ExternalServiceError(err.message);
    throw err;
  }
  if (input.signatureId && !remote) {
    throw new NotFoundError('Signature introuvable ou non autorisee');
  }
  if (!remote) {
    throw new ConflictError(
      'Aucune signature par defaut. Definissez une signature principale avant de signer.',
    );
  }
  // Anti-usurpation: la signature doit appartenir a l'utilisateur qui signe.
  if (remote.user_id && remote.user_id !== ctx.auth.userId) {
    throw new ForbiddenError('Cette signature n\'appartient pas a l\'utilisateur courant');
  }

  // 2) Recuperer le rendu (image DRAWN ou texte TEXT).
  const signatureType = toSignatureType(remote);
  let render: string | null = null;
  if (signatureType === SignatureType.DRAWN) {
    const image = await getSignatureImage(remote.id, ctx.token, academicYearId);
    render = image ? `data:${image.contentType};base64,${image.buffer.toString('base64')}` : null;
  } else {
    render = remote.signature_text ?? remote.display_name ?? signatory.name;
  }

  const signedAt = new Date();

  // 3) Apposer sur le PDF: corps + toutes les signatures recueillies (persistees)
  //    + la signature courante. Si cette etape echoue -> rollback (pas de SIGNED).
  //    Les blocs sont indexes par RANG, pas par ordre d'apposition: la case de
  //    gauche est celle d'EDUCA (rang 0), celle de droite l'etablissement.
  //    Empiler les signataires dans l'ordre ou ils ont signe placait la
  //    signature de l'ecole dans la case d'EDUCA des qu'elle signait la
  //    premiere. Un signataire encore en attente laisse sa case vide, ce qui
  //    est l'information: un contrat a moitie signe ne doit pas avoir l'air
  //    complet.
  const currentBlock: SignatureBlock = {
    name: signatory.name,
    role: signatory.email,
    date: formatDateFr(signedAt),
    type: signatureType,
    render,
  };
  const blocks = [...all]
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => {
      if (s.id === signatory.id) return currentBlock;
      return s.status === SignatoryStatus.SIGNED ? blockFor(s) : null;
    });

  const body = contract.rendered_body ?? fallbackBody(contract);
  const pdf = await htmlToPdfWithSignatures(body, {}, blocks);

  const signedDoc = await attachGeneratedPdf({
    tenantSchoolId: request.tenant_school_id,
    contractId: request.contract_id,
    buffer: pdf,
    fileName: `${contract.contract_number}-signe.pdf`,
    actorUserId: ctx.auth.userId,
    ip: ctx.ip,
    type: DocumentType.SIGNE,
  });

  // 4) Persister le signataire (SIGNED) - rendu conserve pour regenerations futures.
  signatory.status = SignatoryStatus.SIGNED;
  signatory.signature_type = signatureType;
  signatory.signed_at = signedAt;
  signatory.ip = ctx.ip;
  signatory.device = ctx.device;
  signatory.signature_ref = remote.id;
  signatory.signature_render = render;
  signatory.signed_document_id = signedDoc.id;
  await repo.saveSignatory(signatory);

  // 5) Journaliser l'usage cote signature-service (best-effort).
  const usageId = await recordUsage(
    {
      documentType: 'CONTRACT',
      documentId: request.contract_id,
      usedBy: ctx.auth.userId,
      signedAt: signedAt.toISOString(),
      signatureId: remote.id,
    },
    ctx.token,
    academicYearId,
  );

  await recordAudit({
    tenantSchoolId: request.tenant_school_id,
    entityType: 'signatory',
    entityId: signatory.id,
    action: 'SIGN',
    actorUserId: ctx.auth.userId,
    payload: {
      requestId,
      type: signatureType,
      signatureId: remote.id,
      signedDocumentId: signedDoc.id,
      usageId,
    },
    ip: ctx.ip,
  });

  // 6) Tous signes -> COMPLETED + contrat ACTIVE (publie contract.signed).
  const refreshed = await repo.listSignatories(requestId);
  const allSigned = refreshed.every((s) => s.status === SignatoryStatus.SIGNED);
  if (allSigned) {
    request.status = SignatureRequestStatus.COMPLETED;
    await repo.saveRequest(request);
    await transitionStatus(
      request.contract_id,
      { toStatus: ContractStatus.ACTIVE, reason: 'Toutes les signatures recueillies' },
      toRequestContext(ctx),
    );
  }

  return {
    signatory: serializeSignatory(signatory),
    signedDocumentId: signedDoc.id,
    requestCompleted: allSigned,
  };
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
