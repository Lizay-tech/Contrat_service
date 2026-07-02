import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';

/**
 * Client du signature-service (8093) - API REELLE.
 *
 * Le signature-service gere des signatures reutilisables (TEXT/DRAWN) par
 * utilisateur, leurs images (paraphes) et un journal d'utilisations. Ses routes
 * sont authenticate + schoolScope: on TRANSMET donc le JWT de l'appelant
 * (meme secret EDUCA) pour conserver le contexte ecole/annee.
 *
 * Endpoints consommes par contrat-service:
 *   GET  /api/signatures/:id           -> metadonnees d'une signature
 *   GET  /api/signatures/:id/image     -> PNG du paraphe
 *   POST /api/signature-usages         -> journalise une utilisation
 *
 * L'orchestration multi-signataires (demandes, ordre, bascule ACTIVE) reste
 * geree localement par contrat-service; le signature-service fournit l'ASSET de
 * signature et trace son utilisation.
 */
export interface RemoteSignature {
  id: string;
  displayName?: string;
  signatureType?: 'TEXT' | 'DRAWN';
  [k: string]: unknown;
}

export interface RecordUsageInput {
  signatureId: string;
  contractId: string;
  signatoryId: string;
  signatoryName: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function base(): string {
  return `${env.clients.signatureUrl}/api`;
}

/** Recupere une signature. Retourne null si introuvable/indisponible. */
export async function getSignature(id: string, token: string): Promise<RemoteSignature | null> {
  try {
    const res = await fetch(`${base()}/signatures/${id}`, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      logger.warn({ id, status: res.status }, '[signature-client] getSignature non-OK');
      return null;
    }
    const body = (await res.json()) as { data?: RemoteSignature } & RemoteSignature;
    return body.data ?? body;
  } catch (err) {
    logger.warn({ err, id }, '[signature-client] getSignature indisponible');
    return null;
  }
}

/** Recupere l'image (paraphe) en data URL base64. Best-effort. */
export async function getSignatureImageBase64(
  id: string,
  token: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${base()}/signatures/${id}/image`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    logger.warn({ err, id }, '[signature-client] getSignatureImage indisponible');
    return null;
  }
}

/** Journalise une utilisation de signature. Best-effort; retourne l'id d'usage. */
export async function recordUsage(
  input: RecordUsageInput,
  token: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${base()}/signature-usages`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        signature_id: input.signatureId,
        usage_context: 'CONTRACT_SIGNATURE',
        reference_type: 'contract',
        reference_id: input.contractId,
        metadata: { signatoryId: input.signatoryId, signatoryName: input.signatoryName },
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, '[signature-client] recordUsage non-OK');
      return null;
    }
    const body = (await res.json()) as { data?: { id?: string }; id?: string };
    return body.data?.id ?? body.id ?? null;
  } catch (err) {
    logger.warn({ err }, '[signature-client] recordUsage indisponible');
    return null;
  }
}
