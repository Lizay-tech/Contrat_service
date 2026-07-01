import { Request, Response } from 'express';
import { Container } from '../../infrastructure/container';
import { created, ok, paginated } from '../../shared/http/response';
import { UnauthorizedError, ValidationError } from '../../shared/errors/AppError';
import { DocumentType } from '../../domain/enums';
import {
  addPartySchema,
  createContractSchema,
  listContractsQuerySchema,
  transitionSchema,
  updateContractSchema,
} from '../validation/schemas';
import {
  serializeAudit,
  serializeContract,
  serializeDocument,
  serializeParty,
  serializeStatusHistory,
} from '../http/serializers';

function requireAuth(req: Request) {
  if (!req.auth || !req.tenant) throw new UnauthorizedError();
  return { auth: req.auth, tenantSchoolId: req.tenant.tenantSchoolId };
}

export function makeContractController(container: Container) {
  const uc = container.useCases;

  return {
    async create(req: Request, res: Response): Promise<Response> {
      const { auth } = requireAuth(req);
      const body = createContractSchema.parse(req.body);
      const contract = await uc.createContract.execute(auth, {
        contractTypeId: body.contractTypeId,
        title: body.title,
        subjectSchoolId: body.subjectSchoolId ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        durationDays: body.durationDays ?? null,
        trialPeriodDays: body.trialPeriodDays ?? null,
        amount: body.amount ?? null,
        currency: body.currency,
        renewalMode: body.renewalMode,
        metadata: body.metadata,
      });
      return created(res, serializeContract(contract));
    },

    async list(req: Request, res: Response): Promise<Response> {
      const { tenantSchoolId } = requireAuth(req);
      const q = listContractsQuerySchema.parse(req.query);
      const result = await uc.listContracts.execute(tenantSchoolId, {
        status: q.status,
        contractTypeId: q.contractTypeId,
        scope: q.scope,
        subjectSchoolId: q.subjectSchoolId,
        startDateFrom: q.startDateFrom,
        startDateTo: q.startDateTo,
        search: q.search,
        page: q.page,
        limit: q.limit,
      });
      return paginated(
        res,
        result.items.map(serializeContract),
        result.total,
        result.page,
        result.limit,
      );
    },

    async getById(req: Request, res: Response): Promise<Response> {
      const { tenantSchoolId } = requireAuth(req);
      const detail = await uc.getContract.execute(tenantSchoolId, req.params.id);
      return ok(res, {
        contract: serializeContract(detail.contract),
        parties: detail.parties.map(serializeParty),
        documents: detail.documents.map(serializeDocument),
        lastStatusChange: detail.lastStatusChange
          ? serializeStatusHistory(detail.lastStatusChange)
          : null,
      });
    },

    async update(req: Request, res: Response): Promise<Response> {
      const { auth, tenantSchoolId } = requireAuth(req);
      const body = updateContractSchema.parse(req.body);
      const contract = await uc.updateContract.execute(
        tenantSchoolId,
        auth,
        req.params.id,
        body,
      );
      return ok(res, serializeContract(contract));
    },

    async transition(req: Request, res: Response): Promise<Response> {
      const { auth, tenantSchoolId } = requireAuth(req);
      const body = transitionSchema.parse(req.body);
      const contract = await uc.transitionContractStatus.execute(
        tenantSchoolId,
        auth,
        req.params.id,
        { toStatus: body.toStatus, reason: body.reason ?? null },
      );
      return ok(res, serializeContract(contract));
    },

    async addParty(req: Request, res: Response): Promise<Response> {
      const { auth, tenantSchoolId } = requireAuth(req);
      const body = addPartySchema.parse(req.body);
      const party = await uc.addParty.execute(tenantSchoolId, auth, req.params.id, {
        partyType: body.partyType,
        roleInContract: body.roleInContract,
        fullName: body.fullName,
        email: body.email ?? null,
        personUserId: body.personUserId ?? null,
        schoolId: body.schoolId ?? null,
      });
      return created(res, serializeParty(party));
    },

    async removeParty(req: Request, res: Response): Promise<Response> {
      const { auth, tenantSchoolId } = requireAuth(req);
      await uc.removeParty.execute(
        tenantSchoolId,
        auth,
        req.params.id,
        req.params.partyId,
      );
      return ok(res, { deleted: true });
    },

    async uploadDocument(req: Request, res: Response): Promise<Response> {
      const { auth, tenantSchoolId } = requireAuth(req);
      const file = req.file;
      if (!file) throw new ValidationError('A file field "document" is required');

      const rawType = (req.body?.type as string | undefined)?.toUpperCase();
      const type =
        rawType && (Object.values(DocumentType) as string[]).includes(rawType)
          ? (rawType as DocumentType)
          : DocumentType.ORIGINAL;

      const doc = await uc.attachDocument.execute(tenantSchoolId, auth, req.params.id, {
        type,
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      return created(res, serializeDocument(doc));
    },

    async downloadDocument(req: Request, res: Response): Promise<void> {
      const { tenantSchoolId } = requireAuth(req);
      const { record, buffer } = await uc.downloadDocument.execute(
        tenantSchoolId,
        req.params.id,
        req.params.docId,
      );
      res.setHeader('Content-Type', record.mimeType);
      res.setHeader('Content-Length', String(record.sizeBytes));
      res.setHeader('X-Document-Sha256', record.sha256Hash);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="document-${record.version}"`,
      );
      res.status(200).send(buffer);
    },

    async history(req: Request, res: Response): Promise<Response> {
      const { tenantSchoolId } = requireAuth(req);
      const h = await uc.getContractHistory.execute(tenantSchoolId, req.params.id);
      return ok(res, {
        statusHistory: h.statusHistory.map(serializeStatusHistory),
        audit: h.audit.map(serializeAudit),
      });
    },
  };
}
