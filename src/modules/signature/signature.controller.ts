import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { sendCreated, sendData } from '../../shared/http/response';
import type { AuthContext } from '../../shared/types';
import {
  createSignatureRequestSchema,
  remindSchema,
  signSchema,
} from './signature.validator';
import * as service from './signature.service';
import type { SignatureContext } from './signature.service';

function ctxOf(req: Request): SignatureContext {
  const auth = req.auth as AuthContext | undefined;
  if (!auth || !req.tenantSchoolId) throw new UnauthorizedError();
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  return {
    auth,
    tenantSchoolId: req.tenantSchoolId,
    ip: req.ip ?? null,
    device: (req.headers['user-agent'] as string | undefined) ?? null,
    token,
  };
}

export async function postSignatureRequest(req: Request, res: Response): Promise<void> {
  const input = createSignatureRequestSchema.parse(req.body);
  const result = await service.createSignatureRequest(req.params.id as string, input, ctxOf(req));
  sendCreated(res, result);
}

export async function getContractSignatures(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getContractSignatures(req.params.id as string));
}

export async function getAvailableSignatures(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getAvailableSignatures(req.params.id as string, ctxOf(req)));
}

export async function postSign(req: Request, res: Response): Promise<void> {
  const input = signSchema.parse(req.body);
  const result = await service.sign(req.params.requestId as string, input, ctxOf(req));
  sendData(res, result);
}

export async function postRemind(req: Request, res: Response): Promise<void> {
  const input = remindSchema.parse(req.body);
  const result = await service.remind(req.params.requestId as string, input, ctxOf(req));
  sendData(res, result);
}
