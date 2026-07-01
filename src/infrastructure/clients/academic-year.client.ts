import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';
import { redis } from '../redis/redis.client';

/**
 * Client annee-scolaire-service (8082). Recupere l'annee scolaire active pour
 * un tenant et la met en cache Redis (TTL). En cas d'indisponibilite, retourne
 * null: la creation de contrat n'est pas bloquee (annee_scolaire_id nullable).
 */
const CACHE_TTL_SECONDS = 300;

function cacheKey(tenantSchoolId: string): string {
  return `academic-year:active:${tenantSchoolId}`;
}

export async function getActiveAcademicYearId(
  tenantSchoolId: string,
): Promise<string | null> {
  const key = cacheKey(tenantSchoolId);
  try {
    const cached = await redis.get(key);
    if (cached) return cached === 'null' ? null : cached;
  } catch (err) {
    logger.warn({ err }, '[academic-year] lecture cache impossible');
  }

  try {
    const url = `${env.clients.academicYearUrl}/api/v1/academic-years/active?schoolId=${tenantSchoolId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, '[academic-year] reponse non-OK');
      return null;
    }
    const body = (await res.json()) as { data?: { id?: string } };
    const id = body?.data?.id ?? null;
    await redis.set(key, id ?? 'null', 'EX', CACHE_TTL_SECONDS).catch(() => undefined);
    return id;
  } catch (err) {
    logger.warn({ err }, '[academic-year] service indisponible, annee non resolue');
    return null;
  }
}
