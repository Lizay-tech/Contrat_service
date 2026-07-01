import { Router } from 'express';
import { authMiddleware } from './middlewares/auth.middleware';
import { tenantMiddleware } from './middlewares/tenant.middleware';
import { asyncHandler } from '../shared/http/async-handler';
import { getHealth } from '../modules/health/health.controller';
import { contractTypeRoutes } from '../modules/contract-type/contract-type.routes';
import { contractRoutes } from '../modules/contract/contract.routes';

/** Agrege les routes de l'API v1 (montees sous env.apiPrefix). */
export function buildApiRouter(): Router {
  const router = Router();

  // Sante: publique (sonde Kong / orchestrateur).
  router.get('/health', asyncHandler(getHealth));

  // A partir d'ici: authentification JWT + resolution du tenant obligatoires.
  router.use(authMiddleware);
  router.use(tenantMiddleware);

  router.use('/contract-types', contractTypeRoutes);
  router.use('/contracts', contractRoutes);

  return router;
}
