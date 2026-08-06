import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';
import { redis } from '../redis/redis.client';

/**
 * Socle des appels inter-services RESILIENTS.
 *
 * - Propage le JWT de l'appelant (Authorization: Bearer) et, si fourni,
 *   l'en-tete X-Academic-Year-Id.
 * - Deballe l'enveloppe { data } (que le service reponde { ok, data },
 *   { success, data } ou l'objet nu).
 * - Degrade proprement: retourne null (jamais d'exception) si le service est
 *   injoignable, en erreur, ou en timeout. Le contexte s'assemble avec ce qui
 *   est disponible; l'appelant collecte les sources manquantes.
 * - Cache Redis court (best-effort) pour les donnees stables.
 */
export interface FetchOptions {
  token?: string | null;
  academicYearId?: string | null;
  cacheKey?: string;
  ttlSeconds?: number;
  timeoutMs?: number;
}

function buildHeaders(opts: FetchOptions): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) h.Authorization = `Bearer ${opts.token}`;
  if (opts.academicYearId) h['X-Academic-Year-Id'] = opts.academicYearId;
  return h;
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

async function readCache<T>(cacheKey?: string): Promise<T | null> {
  if (!cacheKey || redis.status !== 'ready') return null;
  try {
    const cached = await redis.get(cacheKey);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

async function writeCache(cacheKey: string | undefined, value: unknown, ttl: number): Promise<void> {
  if (!cacheKey || redis.status !== 'ready') return;
  try {
    await redis.set(cacheKey, JSON.stringify(value), 'EX', ttl);
  } catch {
    /* best-effort */
  }
}

/** GET resilient. Retourne l'objet deballe, ou null si indisponible/introuvable. */
export async function getJson<T>(url: string, opts: FetchOptions = {}): Promise<T | null> {
  const cached = await readCache<T>(opts.cacheKey);
  if (cached !== null) return cached;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: buildHeaders(opts),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
    });
  } catch (err) {
    logger.warn({ err, url }, '[inter-service] injoignable');
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    logger.warn({ url, status: res.status }, '[inter-service] reponse non-OK');
    return null;
  }

  let data: T;
  try {
    data = unwrap<T>(await res.json());
  } catch (err) {
    logger.warn({ err, url }, '[inter-service] JSON invalide');
    return null;
  }

  if (data != null) {
    await writeCache(opts.cacheKey, data, opts.ttlSeconds ?? env.aggregationCacheTtl);
  }
  return data;
}
