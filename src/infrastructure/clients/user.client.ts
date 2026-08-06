import { env } from '../../shared/config/env';
import { getJson } from './http-client';

/**
 * Client manage-account. Route reelle: GET /api/users/:id (JWT requis).
 * Enveloppe { success, data }. Sert de complement (email/nom) si le personnel
 * n'est pas trouve dans enseignant-service.
 */
export interface RemoteUser {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: { code?: string; label?: string } | null;
  school_id?: string;
}

export async function getUser(id: string, token?: string | null): Promise<RemoteUser | null> {
  return getJson<RemoteUser>(`${env.clients.manageAccountUrl}/api/users/${id}`, {
    token: token ?? null,
    cacheKey: `user:${id}`,
    ttlSeconds: 60,
  });
}
