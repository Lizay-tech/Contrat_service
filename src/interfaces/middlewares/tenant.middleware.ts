import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../../shared/config/env';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { runInTenantContext } from '../../infrastructure/database/tenant-context';

/**
 * Resolution du tenant RLS pour la requete.
 *
 * Regle: un administrateur EDUCA (roleCode dans EDUCA_ADMIN_ROLES) opere sous le
 * TENANT SYSTEME EDUCA (proprietaire des contrats d'etablissement). Tout autre
 * utilisateur opere sous SON ecole (schoolId du JWT).
 *
 * Consequence: le school_id du body/query est TOUJOURS ignore; seul le JWT
 * (via ce middleware) determine le tenant.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    throw new UnauthorizedError('Contexte d\'authentification absent');
  }
  const isEducaAdmin = env.educaAdminRoles.includes(req.auth.roleCode);
  req.tenantSchoolId = isEducaAdmin ? env.educaSystemTenantId : req.auth.schoolId;
  next();
}

/**
 * Enrobe un handler dans une transaction avec le tenant RLS positionne
 * (SET LOCAL app.tenant_school_id). Commit a la resolution, rollback a l'erreur.
 * A utiliser sur toutes les routes qui touchent des tables metier.
 */
export function tenantHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    const tenant = req.tenantSchoolId;
    if (!tenant) {
      next(new UnauthorizedError('Tenant non resolu'));
      return;
    }
    runInTenantContext(tenant, () => Promise.resolve(fn(req, res, next))).catch(next);
  };
}
