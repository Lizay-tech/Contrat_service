import type { NextFunction, Request, Response } from 'express';
import { getActiveAcademicYearId } from '../../infrastructure/clients/academic-year.client';

/**
 * Resout l'annee scolaire active (cache Redis / annee-scolaire-service) et la
 * pose sur req.academicYearId. Non bloquant: null si le service est indisponible.
 * A appliquer sur les routes de creation qui renseignent annee_scolaire_id.
 */
export async function academicYearMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = req.tenantSchoolId;
    req.academicYearId = tenant ? await getActiveAcademicYearId(tenant) : null;
  } catch {
    req.academicYearId = null;
  }
  next();
}
