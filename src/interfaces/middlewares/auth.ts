import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../shared/config/env';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { AuthContext } from '../../shared/types/context';

interface EducaJwtClaims {
  userId?: string;
  schoolId?: string;
  roleCode?: string;
  sub?: string;
}

/**
 * Verifies the shared-secret JWT issued by manage-account and populates
 * req.auth from its camelCase claims (schoolId, userId, roleCode). The tenant is
 * derived ONLY from schoolId here — never from the request body/query.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing Bearer token'));
  }
  const token = header.slice('Bearer '.length).trim();

  let claims: EducaJwtClaims;
  try {
    claims = jwt.verify(token, env.jwt.secret, {
      algorithms: [env.jwt.algorithm],
    }) as EducaJwtClaims;
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  const userId = claims.userId ?? claims.sub;
  if (!userId || !claims.schoolId || !claims.roleCode) {
    return next(new UnauthorizedError('Token missing required claims'));
  }

  const auth: AuthContext = {
    userId,
    schoolId: claims.schoolId,
    roleCode: claims.roleCode,
  };
  req.auth = auth;
  next();
}
