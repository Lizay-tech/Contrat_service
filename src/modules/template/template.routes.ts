import { Router } from 'express';
import { env } from '../../shared/config/env';
import { tenantHandler } from '../../interfaces/middlewares/tenant.middleware';
import { requireRoles } from '../../interfaces/middlewares/rbac.middleware';
import {
  deleteTemplate,
  getTemplateDetail,
  getTemplateVariables,
  getTemplateVersions,
  getTemplates,
  patchTemplate,
  postArchive,
  postDuplicate,
  postPreview,
  postPublish,
  postTemplate,
} from './template.controller';

const router = Router();
// Creation / edition / publication reservees aux gestionnaires de templates.
const manager = requireRoles(...env.templateManagerRoles);

// Lecture (tout utilisateur authentifie).
router.get('/', tenantHandler(getTemplates));
router.get('/:id', tenantHandler(getTemplateDetail));
router.get('/:id/versions', tenantHandler(getTemplateVersions));
router.get('/:id/variables', tenantHandler(getTemplateVariables));

// Ecriture (RBAC).
router.post('/', manager, tenantHandler(postTemplate));
router.patch('/:id', manager, tenantHandler(patchTemplate));
router.post('/:id/duplicate', manager, tenantHandler(postDuplicate));
router.post('/:id/publish', manager, tenantHandler(postPublish));
router.post('/:id/archive', manager, tenantHandler(postArchive));
router.delete('/:id', manager, tenantHandler(deleteTemplate));

// Preview (lecture; rendu avec donnees d'exemple).
router.post('/:id/preview', tenantHandler(postPreview));

export const templateRoutes = router;
