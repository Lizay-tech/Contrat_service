import { Router } from 'express';
import { tenantHandler } from '../../interfaces/middlewares/tenant.middleware';
import { academicYearMiddleware } from '../../interfaces/middlewares/academic-year.middleware';
import { uploadSingle } from '../../interfaces/middlewares/upload.middleware';
import {
  deleteParty,
  getContractDetail,
  getContractPdf,
  getContracts,
  getHistory,
  patchContract,
  postContract,
  postContractFromTemplate,
  postParty,
  postTransition,
} from './contract.controller';
import {
  getDocument,
  getDocuments,
  postDocument,
} from '../document/document.controller';
import {
  getAvailableSignatures,
  getContractSignatures,
  postSignatureRequest,
} from '../signature/signature.controller';

const router = Router();

// Creation - resout l'annee scolaire active avant d'entrer dans la transaction.
router.post('/', academicYearMiddleware, tenantHandler(postContract));
router.post('/from-template', academicYearMiddleware, tenantHandler(postContractFromTemplate));

router.get('/', tenantHandler(getContracts));
router.get('/:id', tenantHandler(getContractDetail));
router.get('/:id/pdf', tenantHandler(getContractPdf));
router.patch('/:id', tenantHandler(patchContract));

router.post('/:id/transition', tenantHandler(postTransition));

router.post('/:id/parties', tenantHandler(postParty));
router.delete('/:id/parties/:partyId', tenantHandler(deleteParty));

router.post('/:id/documents', uploadSingle, tenantHandler(postDocument));
router.get('/:id/documents', tenantHandler(getDocuments));
router.get('/:id/documents/:docId', tenantHandler(getDocument));

router.get('/:id/history', tenantHandler(getHistory));

// Signature electronique (scope contrat).
router.get('/:id/available-signatures', tenantHandler(getAvailableSignatures));
router.post('/:id/signature-requests', tenantHandler(postSignatureRequest));
router.get('/:id/signatures', tenantHandler(getContractSignatures));

export const contractRoutes = router;
