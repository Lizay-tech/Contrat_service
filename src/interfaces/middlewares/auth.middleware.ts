import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../shared/config/env';
import { UnauthorizedError } from '../../shared/errors/app-error';
import type { AuthContext } from '../../shared/types';

interface EducaJwtClaims {
  userId?: string;
  schoolId?: string;
  roleCode?: string;
  sub?: string;
}

/**
 * Verifie le JWT (secret partage EDUCA) sur chaque route protegee et renseigne
 * req.auth. Les claims sont en camelCase: schoolId, userId, roleCode.
 * Le JWT n'est jamais logue (redaction pino) ni renvoye.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token Bearer manquant');
  }
  const token = header.slice('Bearer '.length).trim();

  let claims: EducaJwtClaims;
  try {
    claims = jwt.verify(token, env.jwtSecret) as EducaJwtClaims;
  } catch {
    throw new UnauthorizedError('Token invalide ou expire');
  }

  const userId = claims.userId ?? claims.sub;
  if (!userId || !claims.schoolId || !claims.roleCode) {
    throw new UnauthorizedError('Claims JWT incomplets (userId, schoolId, roleCode requis)');
  }

  const auth: AuthContext = {
    userId,
    schoolId: claims.schoolId,
    roleCode: claims.roleCode,
  };
  req.auth = auth;
  next();
}
