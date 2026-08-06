import type { Response } from 'express';

<<<<<<< HEAD
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
=======
/** Enveloppe de reponse systematique EDUCA: { success, data?, error? }. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface PaginatedData<T> {
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
  items: T[];
  total: number;
  page: number;
  limit: number;
}

<<<<<<< HEAD
export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  const body: ApiEnvelope<T> = { success: true, data };
  return res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function paginated<T>(
=======
export function sendData<T>(res: Response, data: T, status = 200): Response {
  const body: ApiEnvelope<T> = { success: true, data };
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendData(res, data, 201);
}

export function sendPaginated<T>(
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number,
): Response {
<<<<<<< HEAD
  const body: ApiEnvelope<Paginated<T>> = {
=======
  const body: ApiEnvelope<PaginatedData<T>> = {
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
    success: true,
    data: { items, total, page, limit },
  };
  return res.status(200).json(body);
}

<<<<<<< HEAD
export function fail(
  res: Response,
  statusCode: number,
=======
export function sendError(
  res: Response,
  status: number,
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiEnvelope<never> = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
<<<<<<< HEAD
  return res.status(statusCode).json(body);
=======
  return res.status(status).json(body);
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
}
