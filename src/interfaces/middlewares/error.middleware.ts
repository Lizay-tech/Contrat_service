import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { BaseError as SequelizeBaseError, UniqueConstraintError } from 'sequelize';
import { AppError } from '../../shared/errors/app-error';
import { sendError } from '../../shared/http/response';
import { logger } from '../../shared/config/logger';

/** Middleware 404 (route inconnue). */
export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route introuvable: ${req.method} ${req.originalUrl}`);
}

/**
 * Gestionnaire d'erreurs central. Traduit les erreurs applicatives, de
 * validation (zod) et Sequelize en enveloppe { success:false, error }.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.originalUrl }, err.message);
    }
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Requete invalide',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
    return;
  }

  if (err instanceof UniqueConstraintError) {
    sendError(res, 409, 'CONFLICT', 'Ressource en conflit (contrainte d\'unicite)');
    return;
  }

  if (err instanceof SequelizeBaseError) {
    logger.error({ err, path: req.originalUrl }, 'Erreur base de donnees');
    sendError(res, 500, 'DB_ERROR', 'Erreur base de donnees');
    return;
  }

  logger.error({ err, path: req.originalUrl }, 'Erreur non geree');
  sendError(res, 500, 'INTERNAL_ERROR', 'Erreur interne du serveur');
}
