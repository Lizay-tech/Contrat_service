import Redis from 'ioredis';
import { IAnneeScolaireProvider } from '../../application/ports/services';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logger';

/**
 * Resolves the active school-year id for a tenant. Reads from Redis cache first;
 * on a miss, calls annee-scolaire-service (8082) and caches the result. Failures
 * are non-fatal — a contract can be created with a null annee_scolaire_id and
 * back-filled later, so we never block contract creation on this dependency.
 */
export class AnneeScolaireProvider implements IAnneeScolaireProvider {
  constructor(private readonly redis: Redis) {}

  private cacheKey(tenantSchoolId: string): string {
    return `annee_scolaire:active:${tenantSchoolId}`;
  }

  async getActiveYearId(tenantSchoolId: string): Promise<string | null> {
    const key = this.cacheKey(tenantSchoolId);
    try {
      const cached = await this.redis.get(key);
      if (cached) return cached;
    } catch (err) {
      logger.warn({ err }, 'Redis read failed for active school year');
    }

    const yearId = await this.fetchFromService(tenantSchoolId);
    if (yearId) {
      try {
        await this.redis.set(key, yearId, 'EX', env.redis.anneeScolaireCacheTtl);
      } catch (err) {
        logger.warn({ err }, 'Redis write failed for active school year');
      }
    }
    return yearId;
  }

  private async fetchFromService(tenantSchoolId: string): Promise<string | null> {
    const url = `${env.services.anneeScolaireUrl}/api/v1/annees-scolaires/active`;
    try {
      const res = await fetch(url, {
        headers: { 'x-school-id': tenantSchoolId },
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'annee-scolaire-service returned non-OK');
        return null;
      }
      const body = (await res.json()) as { data?: { id?: string } };
      return body.data?.id ?? null;
    } catch (err) {
      logger.warn({ err }, 'annee-scolaire-service unreachable; proceeding with null');
      return null;
    }
  }
}
