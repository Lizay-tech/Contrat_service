import { env } from '../../shared/config/env';
import { getJson } from './http-client';

/**
 * Client years-service (annee scolaire). Route reelle: GET /academic-years/active
 * (publique, systeme-wide, sans schoolId). Champ `name` = "2025-2026".
 */
export interface AcademicYear {
  id: string;
  name?: string;
  startYear?: number;
  endYear?: number;
  status?: string;
  isActive?: boolean;
}

export async function getActiveAcademicYear(
  token?: string | null,
): Promise<AcademicYear | null> {
  return getJson<AcademicYear>(`${env.clients.academicYearUrl}/academic-years/active`, {
    token: token ?? null,
    cacheKey: 'academic-year:active',
    ttlSeconds: env.aggregationCacheTtl,
  });
}

/** Id de l'annee active (utilise par le middleware). Null si indisponible. */
export async function getActiveAcademicYearId(_tenantSchoolId?: string): Promise<string | null> {
  const year = await getActiveAcademicYear();
  return year?.id ?? null;
}
