/**
 * Interface du client signature-service (8093).
 *
 * Phase 1: l'interface est DEFINIE mais NON implementee (le module signature
 * multiple / paraphes / apposition PDF est prevu en Phase >= 2). Fournir cette
 * abstraction des maintenant permet de brancher l'implementation reelle sans
 * toucher a la couche application.
 */
export interface SignatureRequestInput {
  contractId: string;
  tenantSchoolId: string;
  documentPath: string;
  signatories: Array<{ userId?: string; fullName: string; email: string }>;
}

export interface SignatureRequestResult {
  signatureRequestId: string;
  status: string;
}

export interface SignatureClient {
  createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult>;
  getStatus(signatureRequestId: string): Promise<SignatureRequestResult>;
}

/** Stub Phase 1: leve une erreur explicite si appele avant implementation. */
export class NotImplementedSignatureClient implements SignatureClient {
  createSignatureRequest(): Promise<SignatureRequestResult> {
    throw new Error('SignatureClient non implemente (prevu Phase >= 2).');
  }
  getStatus(): Promise<SignatureRequestResult> {
    throw new Error('SignatureClient non implemente (prevu Phase >= 2).');
  }
}
