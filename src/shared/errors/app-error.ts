/**
 * Hierarchie d'erreurs applicatives. Chaque erreur porte un code HTTP et un code
 * metier stable (utilise dans l'enveloppe de reponse { success:false, error }).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 - entree invalide (schema / format). */
export class ValidationError extends AppError {
  constructor(message = 'Requete invalide', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/** 401 - authentification absente ou invalide. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/** 403 - authentifie mais droits insuffisants (RBAC). */
export class ForbiddenError extends AppError {
  constructor(message = 'Acces refuse') {
    super(403, 'FORBIDDEN', message);
  }
}

/** 404 - ressource introuvable. */
export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(404, 'NOT_FOUND', message);
  }
}

/** 409 - conflit (ex. transition d'etat non autorisee, doublon). */
export class ConflictError extends AppError {
  constructor(message = 'Conflit', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

/** 422 - regle metier violee (entree valide mais action impossible). */
export class BusinessRuleError extends AppError {
  constructor(message = 'Regle metier non respectee', details?: unknown) {
    super(422, 'BUSINESS_RULE_ERROR', message, details);
  }
}

/** 502 - un service externe (ex. signature-service) est injoignable ou en erreur. */
export class ExternalServiceError extends AppError {
  constructor(message = 'Service externe indisponible', details?: unknown) {
    super(502, 'EXTERNAL_SERVICE_ERROR', message, details);
  }
}
