import type { Response } from 'express';

/** Standard EDUCA response envelope. */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  const body: ApiEnvelope<T> = { success: true, data };
  return res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function paginated<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number,
): Response {
  const body: ApiEnvelope<Paginated<T>> = {
    success: true,
    data: { items, total, page, limit },
  };
  return res.status(200).json(body);
}

export function fail(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiEnvelope<never> = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  return res.status(statusCode).json(body);
}
