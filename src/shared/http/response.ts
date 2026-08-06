import type { Response } from 'express';

/** Enveloppe de reponse systematique EDUCA: { success, data?, error? }. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function sendData<T>(res: Response, data: T, status = 200): Response {
  const body: ApiEnvelope<T> = { success: true, data };
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendData(res, data, 201);
}

export function sendPaginated<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number,
): Response {
  const body: ApiEnvelope<PaginatedData<T>> = {
    success: true,
    data: { items, total, page, limit },
  };
  return res.status(200).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiEnvelope<never> = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  return res.status(status).json(body);
}
