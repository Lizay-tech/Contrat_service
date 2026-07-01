import jwt from 'jsonwebtoken';
import { env } from '../../src/shared/config/env';

export interface TokenClaims {
  userId: string;
  schoolId: string;
  roleCode: string;
}

/** Signs an EDUCA-style access token with the shared secret for tests. */
export function signToken(claims: TokenClaims): string {
  return jwt.sign(claims, env.jwt.secret, {
    algorithm: env.jwt.algorithm,
    expiresIn: '1h',
  });
}

export function bearer(claims: TokenClaims): string {
  return `Bearer ${signToken(claims)}`;
}
