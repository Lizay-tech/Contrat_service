import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { TenantContext } from '../../shared/types/context';

/**
 * Establishes the tenant context from the authenticated JWT. tenantSchoolId is
 * the caller's schoolId — the RLS key. It is later bound to the PG session as
 * `app.tenant_school_id` via SET LOCAL inside each use-case transaction
 * (SequelizeUnitOfWork), which is the connection-pool-safe way to scope RLS.
 *
 * Cross-tenant writes (an EDUCA admin creating an ETABLISSEMENT contract under
 * the system tenant) are handled explicitly in the CreateContract use-case,
 * which runs its transaction under the resolved system tenant.
 */
export function tenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    return next(new UnauthorizedError('Authentication required'));
  }
  const ctx: TenantContext = { tenantSchoolId: req.auth.schoolId };
  req.tenant = ctx;
  next();
}
