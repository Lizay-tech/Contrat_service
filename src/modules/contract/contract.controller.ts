import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { sendCreated, sendData, sendPaginated } from '../../shared/http/response';
import type { AuthContext } from '../../shared/types';
import {
  addPartySchema,
  createContractSchema,
  listContractsQuerySchema,
  transitionSchema,
  updateContractSchema,
} from './contract.validator';
import * as service from './contract.service';
import type { RequestContext } from './contract.service';

function buildContext(req: Request): RequestContext {
  const auth = req.auth as AuthContext | undefined;
  if (!auth || !req.tenantSchoolId) throw new UnauthorizedError();
  return {
    auth,
    tenantSchoolId: req.tenantSchoolId,
    academicYearId: req.academicYearId ?? null,
    ip: req.ip ?? null,
  };
}

export async function postContract(req: Request, res: Response): Promise<void> {
  const input = createContractSchema.parse(req.body);
  const result = await service.createContract(input, buildContext(req));
  sendCreated(res, result);
}

export async function getContracts(req: Request, res: Response): Promise<void> {
  const query = listContractsQuerySchema.parse(req.query);
  const { items, total, page, limit } = await service.listContracts(query);
  sendPaginated(res, items, total, page, limit);
}

export async function getContractDetail(req: Request, res: Response): Promise<void> {
  const result = await service.getContract(req.params.id as string);
  sendData(res, result);
}

export async function patchContract(req: Request, res: Response): Promise<void> {
  const input = updateContractSchema.parse(req.body);
  const result = await service.updateContract(req.params.id as string, input, buildContext(req));
  sendData(res, result);
}

export async function postTransition(req: Request, res: Response): Promise<void> {
  const input = transitionSchema.parse(req.body);
  const result = await service.transitionStatus(
    req.params.id as string,
    input,
    buildContext(req),
  );
  sendData(res, result);
}

export async function postParty(req: Request, res: Response): Promise<void> {
  const input = addPartySchema.parse(req.body);
  const result = await service.addParty(req.params.id as string, input, buildContext(req));
  sendCreated(res, result);
}

export async function deleteParty(req: Request, res: Response): Promise<void> {
  await service.removeParty(
    req.params.id as string,
    req.params.partyId as string,
    buildContext(req),
  );
  res.status(204).send();
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  const result = await service.getHistory(req.params.id as string);
  sendData(res, result);
}
