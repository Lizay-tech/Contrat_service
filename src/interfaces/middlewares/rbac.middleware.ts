import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../../shared/config/env';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/app-error';

/**
 * RBAC minimaliste base sur roleCode (issu du JWT). Verifie que le role de
 * l'appelant figure dans la liste autorisee pour la route.
 */
export function requireRoles(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new UnauthorizedError();
    if (!roles.includes(req.auth.roleCode)) {
      throw new ForbiddenError(
        `Role '${req.auth.roleCode}' non autorise. Requis: [${roles.join(', ')}]`,
      );
    }
    next();
  };
}

/** Restreint l'acces aux administrateurs EDUCA (EDUCA_ADMIN_ROLES). */
export function requireEducaAdmin(): RequestHandler {
  return requireRoles(...env.educaAdminRoles);
}

/** Vrai si le role courant est un administrateur EDUCA. */
export function isEducaAdmin(roleCode: string): boolean {
  return env.educaAdminRoles.includes(roleCode);
}
