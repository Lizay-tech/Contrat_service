import { env } from '../../shared/config/env';
import { getJson } from './http-client';
import type { AssignmentBlock } from '../../modules/aggregation/contract-context';

/**
 * Client affectations-academiques-service (route reelle, port 3006).
 *   GET /api/affectations/enseignants/:id        -> affectation par id
 *   GET /api/affectations/enseignants?enseignant_id=...&is_active=true -> liste
 * JWT + tenant requis (propages). Enveloppe { success, data } / { success, data: [] }.
 *
 * Ce service NE porte PAS poste/departement/manager (ceux-ci viennent du dossier
 * personnel). Il apporte: date de prise de fonction (dateDebut), statut (isActive),
 * type d'affectation, ecole. On enrichit donc l'affectation derivee du personnel.
 */
interface RemoteAssignment {
  id?: string;
  ecoleId?: string;
  enseignantId?: string;
  type?: string;
  dateDebut?: string;
  dateFin?: string | null;
  isActive?: boolean;
}

function map(a: RemoteAssignment): Partial<AssignmentBlock> {
  const block: Partial<AssignmentBlock> = {};
  if (a.dateDebut) block.startDate = a.dateDebut;
  if (a.ecoleId) block.schoolId = a.ecoleId;
  if (typeof a.isActive === 'boolean') block.status = a.isActive ? 'actif' : 'inactif';
  return block;
}

export interface AssignmentQuery {
  assignmentId?: string | null;
  employeeId?: string | null;
}

export async function getAssignment(
  query: AssignmentQuery,
  token: string | null,
  academicYearId: string | null,
): Promise<Partial<AssignmentBlock> | null> {
  const base = `${env.clients.affectationUrl}/api/affectations/enseignants`;

  if (query.assignmentId) {
    const a = await getJson<RemoteAssignment>(`${base}/${query.assignmentId}`, {
      token,
      academicYearId,
      cacheKey: `affectation:${query.assignmentId}`,
      ttlSeconds: 60,
    });
    return a ? map(a) : null;
  }

  if (query.employeeId) {
    const list = await getJson<RemoteAssignment[]>(
      `${base}?enseignant_id=${query.employeeId}&is_active=true`,
      { token, academicYearId, ttlSeconds: 60 },
    );
    const first = Array.isArray(list) ? list[0] : null;
    return first ? map(first) : null;
  }

  return null;
}
