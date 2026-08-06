import { env } from '../../shared/config/env';
import { getJson } from './http-client';

/**
 * Client ecole-service. Route reelle: GET /api/schools/by-id/:id
 * Enveloppe { ok, data } (deballe par http-client). Champs IMBRIQUES.
 * (director/cachet/devise n'existent pas dans le modele -> non fournis).
 */
export interface RemoteSchool {
  meta?: { code_ecole?: string };
  identity?: { nom?: string; logo_url?: string };
  contact?: {
    email_officiel?: string | null;
    telephone?: string | null;
    site_web?: string | null;
    adresse_ligne1?: string;
    adresse_ligne2?: string | null;
    ville?: string | null;
    departement?: string;
    pays?: string | null;
    time_zone?: string | null;
  };
  access?: Array<{
    contactResponsableNom?: string;
    contactResponsableEmail?: string;
    contactResponsableTelephone?: string;
  }>;
}

export async function getSchool(
  id: string,
  token?: string | null,
): Promise<RemoteSchool | null> {
  return getJson<RemoteSchool>(`${env.clients.ecoleUrl}/api/schools/by-id/${id}`, {
    token: token ?? null,
    cacheKey: `ecole:${id}`,
    ttlSeconds: env.aggregationCacheTtl,
  });
}
