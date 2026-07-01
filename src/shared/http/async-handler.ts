import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Enrobe un handler async pour propager les rejets vers le middleware d'erreur
 * Express (evite les try/catch repetitifs dans les controllers).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
