import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/AppError';

/**
 * RBAC guard factory. Passing no roles means "any authenticated user". Passing
 * roles restricts the route to callers whose JWT roleCode is in the list.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.auth.roleCode)) {
      return next(
        new ForbiddenError(
          `Role ${req.auth.roleCode} is not permitted to perform this action`,
        ),
      );
    }
    next();
  };
}
