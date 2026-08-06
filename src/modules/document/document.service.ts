import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { DocumentType, type AuthContext } from '../../shared/types';
import { readDocument, saveDocument } from '../../infrastructure/storage/file-storage';
import { findContractById } from '../contract/contract.repository';
import { recordAudit } from '../audit/audit.service';
import { serializeDocument } from '../contract/contract.serializer';
import * as repo from './document.repository';

export interface UploadContext {
  auth: AuthContext;
  ip: string | null;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Attache un document a un contrat: persiste le fichier, calcule le sha256
 * (integrite documentaire) et incremente la version. Journalise dans l'audit.
 */
export async function attachDocument(
  contractId: string,
  file: UploadedFile | undefined,
  type: DocumentType | undefined,
  ctx: UploadContext,
) {
  if (!file) throw new ValidationError('Fichier manquant (champ multipart "file")');

  const contract = await findContractById(contractId);
  if (!contract) throw new NotFoundError('Contrat introuvable');

  const version = await repo.nextVersion(contractId);
  const ext = path.extname(file.originalname) || '.bin';
  const uniqueName = `v${version}-${randomUUID()}${ext}`;

  const stored = await saveDocument({
    tenantSchoolId: contract.tenant_school_id,
    contractId,
    uniqueName,
    buffer: file.buffer,
  });

  const document = await repo.createDocument({
    tenant_school_id: contract.tenant_school_id,
    contract_id: contractId,
    type: type ?? DocumentType.ORIGINAL,
    file_path: stored.filePath,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size_bytes: stored.sizeBytes,
    sha256_hash: stored.sha256,
    version,
    uploaded_by: ctx.auth.userId,
  });

  await recordAudit({
    tenantSchoolId: contract.tenant_school_id,
    entityType: 'contract_document',
    entityId: document.id,
    action: 'UPLOAD',
    actorUserId: ctx.auth.userId,
    payload: { contractId, version, sha256: stored.sha256, type: document.type },
    ip: ctx.ip,
  });

  return serializeDocument(document);
}

/**
 * Attache un PDF GENERE par le serveur (depuis un template) a un contrat.
 * Reutilise le meme stockage/hash/versionnement que l'upload manuel.
 */
export async function attachGeneratedPdf(params: {
  tenantSchoolId: string;
  contractId: string;
  buffer: Buffer;
  fileName: string;
  actorUserId: string;
  ip: string | null;
  type?: DocumentType;
}) {
  const version = await repo.nextVersion(params.contractId);
  const uniqueName = `v${version}-${randomUUID()}.pdf`;
  const stored = await saveDocument({
    tenantSchoolId: params.tenantSchoolId,
    contractId: params.contractId,
    uniqueName,
    buffer: params.buffer,
  });

  const document = await repo.createDocument({
    tenant_school_id: params.tenantSchoolId,
    contract_id: params.contractId,
    type: params.type ?? DocumentType.ORIGINAL,
    file_path: stored.filePath,
    original_name: params.fileName,
    mime_type: 'application/pdf',
    size_bytes: stored.sizeBytes,
    sha256_hash: stored.sha256,
    version,
    uploaded_by: params.actorUserId,
  });

  await recordAudit({
    tenantSchoolId: params.tenantSchoolId,
    entityType: 'contract_document',
    entityId: document.id,
    action: document.type === DocumentType.SIGNE ? 'SIGN_PDF' : 'GENERATE_PDF',
    actorUserId: params.actorUserId,
    payload: { contractId: params.contractId, version, sha256: stored.sha256, type: document.type },
    ip: params.ip,
  });

  return serializeDocument(document);
}

export interface DownloadResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

/** Telechargement authentifie d'un document (le tenant est filtre par RLS). */
export async function downloadDocument(
  contractId: string,
  docId: string,
): Promise<DownloadResult> {
  const document = await repo.findDocument(contractId, docId);
  if (!document) throw new NotFoundError('Document introuvable');
  const buffer = await readDocument(document.file_path);
  return { buffer, mimeType: document.mime_type, fileName: document.original_name };
}

export async function listContractDocuments(contractId: string) {
  const docs = await repo.listDocuments(contractId);
  return docs.map(serializeDocument);
}
