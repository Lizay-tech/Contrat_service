import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { sendCreated, sendData } from '../../shared/http/response';
import type { AuthContext } from '../../shared/types';
import { uploadDocumentSchema } from '../contract/contract.validator';
import * as service from './document.service';

export async function postDocument(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthContext | undefined;
  if (!auth) throw new UnauthorizedError();
  const { type } = uploadDocumentSchema.parse(req.body ?? {});
  const result = await service.attachDocument(
    req.params.id as string,
    req.file as service.UploadedFile | undefined,
    type,
    { auth, ip: req.ip ?? null },
  );
  sendCreated(res, result);
}

export async function getDocuments(req: Request, res: Response): Promise<void> {
  const result = await service.listContractDocuments(req.params.id as string);
  sendData(res, result);
}

export async function getDocument(req: Request, res: Response): Promise<void> {
  const { buffer, mimeType, fileName } = await service.downloadDocument(
    req.params.id as string,
    req.params.docId as string,
  );
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.status(200).send(buffer);
}
