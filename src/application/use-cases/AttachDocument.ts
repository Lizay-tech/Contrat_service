import { DocumentType } from '../../domain/enums';
import { NotFoundError } from '../../shared/errors/AppError';
import { AuthContext } from '../../shared/types/context';
import { UseCaseDeps } from '../deps';
import { DocumentRecord } from '../ports/repositories';

export interface AttachDocumentInput {
  type: DocumentType;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Stores an uploaded document: persists the file, computes its sha256, assigns
 * the next version number and records the metadata + audit entry.
 */
export class AttachDocument {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(
    tenantSchoolId: string,
    auth: AuthContext,
    contractId: string,
    input: AttachDocumentInput,
  ): Promise<DocumentRecord> {
    const { deps } = this;

    // Persist file first (idempotent-ish; the DB row is the source of truth).
    const stored = await deps.fileStorage.save({
      tenantSchoolId,
      contractId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      buffer: input.buffer,
    });

    return deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const contract = await deps.contractRepo.findById(contractId, tx);
      if (!contract) throw new NotFoundError('Contract not found');

      const version = (await deps.documentRepo.maxVersion(contractId, tx)) + 1;

      const doc = await deps.documentRepo.create(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          contractId,
          type: input.type,
          filePath: stored.filePath,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          sha256Hash: stored.sha256Hash,
          version,
          uploadedBy: auth.userId,
        },
        tx,
      );

      await deps.auditRepo.record(
        {
          id: deps.ids.uuid(),
          tenantSchoolId,
          entityType: 'contract_document',
          entityId: doc.id,
          action: 'CREATE',
          actorUserId: auth.userId,
          payload: {
            contractId,
            type: input.type,
            version,
            sha256: stored.sha256Hash,
          },
          ip: null,
        },
        tx,
      );

      return doc;
    });
  }
}
