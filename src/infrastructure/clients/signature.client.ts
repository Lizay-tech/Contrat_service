import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';

/**
 * Client du signature-service (8093) - API REELLE.
 *
 * Le signature-service gere les signatures reutilisables (TEXT/DRAWN) d'un
 * utilisateur, leurs images (paraphes) et un journal d'utilisations. Ses routes
 * sont authenticate + schoolScope et exigent l'en-tete X-Academic-Year-Id.
 * On TRANSMET donc le JWT de l'appelant (meme secret EDUCA) + l'annee scolaire
 * du contrat.
 *
 * Endpoints consommes:
 *   GET  /api/signatures               -> signatures de l'utilisateur courant
 *   GET  /api/signatures/:id           -> detail
 *   GET  /api/signatures/:id/image     -> octets du paraphe (apposition)
 *   POST /api/signature-usages         -> journalise un usage
 */
export interface RemoteSignature {
  id: string;
  user_id?: string;
  display_name?: string;
  signature_type?: 'TEXT' | 'DRAWN';
  signature_text?: string | null;
  signature_image_url?: string | null;
  is_default?: boolean;
  status?: string;
  [k: string]: unknown;
}

export class SignatureServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureServiceError';
  }
}

function headers(token: string, academicYearId: string | null): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (academicYearId) h['X-Academic-Year-Id'] = academicYearId;
  return h;
}

function base(): string {
  return `${env.clients.signatureUrl}/api`;
}

function unwrap<T>(body: unknown): T {
  const b = body as { data?: T };
  return (b?.data ?? body) as T;
}

/** Liste les signatures de l'utilisateur courant. Leve si le service est injoignable. */
export async function listUserSignatures(
  token: string,
  academicYearId: string | null,
): Promise<RemoteSignature[]> {
  let res: Response;
  try {
    res = await fetch(`${base()}/signatures`, {
      headers: headers(token, academicYearId),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.error({ err }, '[signature-client] listUserSignatures: service injoignable');
    throw new SignatureServiceError('Le service de signature est injoignable');
  }
  if (!res.ok) {
    throw new SignatureServiceError(`Le service de signature a repondu ${res.status}`);
  }
  const data = unwrap<RemoteSignature[]>(await res.json());
  return Array.isArray(data) ? data : [];
}

/** Signature par defaut ACTIVE de l'utilisateur (null si aucune). */
export async function getDefaultSignature(
  token: string,
  academicYearId: string | null,
): Promise<RemoteSignature | null> {
  const list = await listUserSignatures(token, academicYearId);
  const isActive = (s: RemoteSignature) => !s.status || s.status.toUpperCase() === 'ACTIVE';
  return list.find((s) => s.is_default === true && isActive(s)) ?? null;
}

/** Detail d'une signature (null si introuvable). */
export async function getSignature(
  id: string,
  token: string,
  academicYearId: string | null,
): Promise<RemoteSignature | null> {
  let res: Response;
  try {
    res = await fetch(`${base()}/signatures/${id}`, {
      headers: headers(token, academicYearId),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.error({ err, id }, '[signature-client] getSignature: service injoignable');
    throw new SignatureServiceError('Le service de signature est injoignable');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new SignatureServiceError(`Le service de signature a repondu ${res.status}`);
  return unwrap<RemoteSignature>(await res.json());
}

export interface SignatureImage {
  buffer: Buffer;
  contentType: string;
}

/** Octets de l'image du paraphe (pour apposition). Null si indisponible. */
export async function getSignatureImage(
  id: string,
  token: string,
  academicYearId: string | null,
): Promise<SignatureImage | null> {
  try {
    const res = await fetch(`${base()}/signatures/${id}/image`, {
      headers: headers(token, academicYearId),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? 'image/png',
    };
  } catch (err) {
    logger.warn({ err, id }, '[signature-client] getSignatureImage indisponible');
    return null;
  }
}

export interface RecordUsageInput {
  documentType: string; // 'CONTRACT'
  documentId: string;
  usedBy: string;
  signedAt: string;
  signatureId: string;
}

/** Journalise un usage cote signature-service. Best-effort; retourne l'id d'usage. */
export async function recordUsage(
  input: RecordUsageInput,
  token: string,
  academicYearId: string | null,
): Promise<string | null> {
  try {
    const res = await fetch(`${base()}/signature-usages`, {
      method: 'POST',
      headers: { ...headers(token, academicYearId), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: input.documentType,
        document_id: input.documentId,
        used_by: input.usedBy,
        signed_at: input.signedAt,
        signature_id: input.signatureId,
      }),
      signal: AbortSignal.timeout(5000),
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
