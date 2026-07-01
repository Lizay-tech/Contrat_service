import { NotFoundError } from '../../shared/errors/AppError';
import { UseCaseDeps } from '../deps';
import { DocumentRecord } from '../ports/repositories';

export interface DownloadedDocument {
  record: DocumentRecord;
  buffer: Buffer;
}

/** Returns an authenticated document's metadata + bytes (RLS enforced). */
export class DownloadDocument {
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(
    tenantSchoolId: string,
    contractId: string,
    documentId: string,
  ): Promise<DownloadedDocument> {
    const { deps } = this;
    const record = await deps.uow.runInTenant(tenantSchoolId, async (tx) => {
      const doc = await deps.documentRepo.findById(documentId, tx);
      if (!doc || doc.contractId !== contractId) {
        throw new NotFoundError('Document not found for this contract');
      }
      return doc;
    });

    const buffer = await deps.fileStorage.read(record.filePath);
    return { record, buffer };
  }
}
