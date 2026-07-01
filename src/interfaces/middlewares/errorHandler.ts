import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { BaseError as SequelizeBaseError, UniqueConstraintError } from 'sequelize';
import { AppError } from '../../shared/errors/AppError';
import {
  ContractInvariantError,
  DomainError,
  IllegalTransitionError,
} from '../../domain/errors';
import { fail } from '../../shared/http/response';
import { logger } from '../../shared/logger';

/**
 * Central error handler translating any thrown error into the EDUCA envelope
 * with the correct HTTP status. Domain errors are mapped explicitly:
 *   IllegalTransitionError  -> 409 (illegal state transition)
 *   ContractInvariantError  -> 422 (business rule)
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // --- Known application errors ---
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.requestId }, err.message);
    }
    fail(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // --- Domain errors ---
  if (err instanceof IllegalTransitionError) {
    fail(res, 409, 'ILLEGAL_TRANSITION', err.message, {
      from: err.from,
      to: err.to,
    });
    return;
  }
  if (err instanceof ContractInvariantError) {
    fail(res, 422, 'BUSINESS_RULE_VIOLATION', err.message);
    return;
  }
  if (err instanceof DomainError) {
    fail(res, 422, 'BUSINESS_RULE_VIOLATION', err.message);
    return;
  }

  // --- Validation ---
  if (err instanceof ZodError) {
    fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', err.issues);
    return;
  }

  // --- Sequelize ---
  if (err instanceof UniqueConstraintError) {
    fail(res, 409, 'CONFLICT', 'Resource already exists', {
      fields: err.fields,
    });
    return;
  }
  if (err instanceof SequelizeBaseError) {
    logger.error({ err, requestId: req.requestId }, 'Database error');
    fail(res, 500, 'DATABASE_ERROR', 'A database error occurred');
    return;
  }

  // --- Unknown ---
  logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

/** 404 fallback for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  fail(res, 404, 'NOT_FOUND', 'Route not found');
}
