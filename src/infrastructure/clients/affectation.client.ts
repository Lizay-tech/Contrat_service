import type { AssignmentBlock } from '../../modules/aggregation/contract-context';

/**
 * Client affectation-service (source DEDIEE, optionnelle).
 *
 * Note: enseignant-service porte deja poste/departement/ecole/superviseur, qui
 * suffisent a deriver l'affectation (cf. assignmentFromEmployee). Ce client
 * enrichit avec une source dediee QUAND ses routes sont confirmees. Tant que ce
 * n'est pas le cas, il degrade proprement (retourne null) et l'affectation
 * derivee du dossier personnel est utilisee.
 */
export interface AssignmentQuery {
  assignmentId?: string | null;
  employeeId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getAssignment(
  _query: AssignmentQuery,
  _token: string | null,
  _academicYearId: string | null,
): Promise<Partial<AssignmentBlock> | null> {
  // TODO(reseau): brancher la route reelle du service d'affectation une fois
  // confirmee (methode + chemin + champs). Pour l'instant, source non dediee.
  return null;
}
