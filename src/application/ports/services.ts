/** Domain event published to RabbitMQ. */
export interface DomainEvent {
  routingKey: string; // e.g. contract.created
  payload: Record<string, unknown>;
}

export interface IEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

/** Resolves the active school year for a tenant (cached in Redis). */
export interface IAnneeScolaireProvider {
  getActiveYearId(tenantSchoolId: string): Promise<string | null>;
}

/** Monotonic clock — injected so the domain/use-cases stay testable. */
export interface IClock {
  now(): Date;
}

/** Id generation (UUID v4) — injected for testability. */
export interface IIdGenerator {
  uuid(): string;
}

export interface StoredFile {
  filePath: string;
  sizeBytes: number;
  sha256Hash: string;
  mimeType: string;
}

/** Abstracts document persistence (local disk in Phase 1, S3 later). */
export interface IFileStorage {
  save(params: {
    tenantSchoolId: string;
    contractId: string;
    originalName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<StoredFile>;
  read(filePath: string): Promise<Buffer>;
}

/** Server-side PDF generation for contract documents. */
export interface IPdfGenerator {
  renderContractPdf(input: {
    title: string;
    contractNumber: string;
    body: string;
  }): Promise<Buffer>;
}

/**
 * Signature-service (8093) client. Defined for Phase 1 but NOT implemented yet;
 * the concrete client throws NotImplemented until Phase 2 wiring.
 */
export interface ISignatureClient {
  requestSignature(input: {
    contractId: string;
    documentPath: string;
    signatories: Array<{ fullName: string; email: string }>;
  }): Promise<{ signatureRequestId: string }>;
}
