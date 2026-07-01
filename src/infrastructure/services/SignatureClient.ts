import { ISignatureClient } from '../../application/ports/services';

/**
 * Client for signature-service (8093). The interface is DEFINED in Phase 1 so
 * the use-cases can depend on it, but the concrete integration is deferred to
 * Phase 2 — hence NotImplemented here.
 */
export class NotImplementedSignatureClient implements ISignatureClient {
  async requestSignature(): Promise<{ signatureRequestId: string }> {
    throw new Error(
      'SignatureClient is not implemented in Phase 1 (signature-service integration is Phase 2)',
    );
  }
}
