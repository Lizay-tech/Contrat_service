import { Request, Response } from 'express';
import { Container } from '../../infrastructure/container';
import { ok } from '../../shared/http/response';
import { UnauthorizedError } from '../../shared/errors/AppError';

export function makeContractTypeController(container: Container) {
  return {
    async list(req: Request, res: Response): Promise<Response> {
      if (!req.tenant) throw new UnauthorizedError();
      const types = await container.useCases.listContractTypes.execute(
        req.tenant.tenantSchoolId,
      );
      return ok(res, types);
    },
  };
}
