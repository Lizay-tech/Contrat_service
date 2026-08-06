import { Router } from 'express';
import { tenantHandler } from '../../interfaces/middlewares/tenant.middleware';
import { postRemind, postSign } from './signature.controller';

/** Routes de premier niveau: /signature-requests/:requestId/... */
const router = Router();

router.post('/:requestId/sign', tenantHandler(postSign));
router.post('/:requestId/remind', tenantHandler(postRemind));

export const signatureRoutes = router;
