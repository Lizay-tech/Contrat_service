import type { AuthContext } from './index';

declare global {
  namespace Express {
    interface Request {
      /** Contexte d'authentification issu du JWT (renseigne par authMiddleware). */
      auth?: AuthContext;
      /** Tenant RLS resolu pour la requete (renseigne par tenantMiddleware). */
      tenantSchoolId?: string;
      /** Annee scolaire active resolue (renseigne par academicYearMiddleware). */
      academicYearId?: string | null;
      /** Identifiant de correlation de la requete. */
      requestId?: string;
    }
  }
}

export {};
