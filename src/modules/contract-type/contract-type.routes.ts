import { Router } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { getContractTypes } from './contract-type.controller';

const router = Router();

// GET /contract-types - referentiel (route protegee par JWT au niveau app).
router.get('/', asyncHandler(getContractTypes));

export const contractTypeRoutes = router;
