import type { Request, Response } from 'express';
import { sendData } from '../../shared/http/response';
import { listContractTypes } from './contract-type.service';

export async function getContractTypes(_req: Request, res: Response): Promise<void> {
  const types = await listContractTypes(true);
  sendData(
    res,
    types.map((t) => ({
      id: t.id,
      code: t.code,
      label: t.label,
      scope: t.scope,
      defaultRenewalMode: t.default_renewal_mode,
      active: t.active,
    })),
  );
}
