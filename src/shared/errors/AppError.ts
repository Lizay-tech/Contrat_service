/**
 * Base application error. Every thrown error that should map to a clean HTTP
 * response extends this. Unknown errors are treated as 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 - request payload / params failed validation. */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/** 401 - missing / invalid authentication. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 - authenticated but not allowed (RBAC). */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 - resource not found (or invisible due to RLS). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 409 - conflict (duplicate, illegal state transition). */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

/** 422 - request understood but violates a business rule. */
export class BusinessRuleError extends AppError {
  constructor(message = 'Business rule violation', details?: unknown) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', details);
  }
}

/** 503 - a downstream dependency is unavailable. */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', details?: unknown) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}
