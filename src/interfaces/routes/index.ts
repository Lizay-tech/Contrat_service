import { Router } from 'express';
import { Container } from '../../infrastructure/container';
import { authenticate } from '../middlewares/auth';
import { tenant } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import { asyncHandler } from '../http/asyncHandler';
import { makeContractController } from '../controllers/ContractController';
import { makeContractTypeController } from '../controllers/ContractTypeController';
import { makeHealthController } from '../controllers/HealthController';
import { uploadDocument } from './upload';

/**
 * Wires the Phase 1 REST API under /api/v1. Every business route is protected by
 * JWT auth + tenant context; RBAC guards are applied where required.
 */
export function buildRouter(container: Container): Router {
  const router = Router();
  const contracts = makeContractController(container);
  const contractTypes = makeContractTypeController(container);
  const health = makeHealthController(container);

  // --- Health (public) ---
  router.get('/health', asyncHandler(health.health));

  // Everything below requires authentication + tenant resolution.
  const authed = [authenticate, tenant];

  // --- Reference data ---
  router.get(
    '/api/v1/contract-types',
    ...authed,
    asyncHandler(contractTypes.list),
  );

  // --- Contracts ---
  router.post(
    '/api/v1/contracts',
    ...authed,
    // Any authenticated user may create; the use-case enforces that only EDUCA
    // admins can create ETABLISSEMENT-scoped contracts.
    requireRole(),
    asyncHandler(contracts.create),
  );

  router.get('/api/v1/contracts', ...authed, asyncHandler(contracts.list));
  router.get('/api/v1/contracts/:id', ...authed, asyncHandler(contracts.getById));
  router.patch('/api/v1/contracts/:id', ...authed, asyncHandler(contracts.update));

  router.post(
    '/api/v1/contracts/:id/transition',
    ...authed,
    asyncHandler(contracts.transition),
  );

  // --- Parties ---
  router.post(
    '/api/v1/contracts/:id/parties',
    ...authed,
    asyncHandler(contracts.addParty),
  );
  router.delete(
    '/api/v1/contracts/:id/parties/:partyId',
    ...authed,
    asyncHandler(contracts.removeParty),
  );

  // --- Documents ---
  router.post(
    '/api/v1/contracts/:id/documents',
    ...authed,
    uploadDocument.single('document'),
    asyncHandler(contracts.uploadDocument),
  );
  router.get(
    '/api/v1/contracts/:id/documents/:docId',
    ...authed,
    asyncHandler(contracts.downloadDocument),
  );

  // --- History ---
  router.get(
    '/api/v1/contracts/:id/history',
    ...authed,
    asyncHandler(contracts.history),
  );

  return router;
}
