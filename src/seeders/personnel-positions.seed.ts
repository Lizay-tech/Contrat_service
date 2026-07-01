/**
 * Reference catalogue of school-staff positions ("catalogue des postes du
 * personnel"). Phase 1 has no dedicated table for it; it is exposed as static
 * reference data (e.g. to populate a party's role/title in the UI) and can be
 * promoted to a table in a later phase without breaking callers.
 */
export interface PersonnelPosition {
  code: string;
  label: string;
  category: 'DIRECTION' | 'ENSEIGNEMENT' | 'ADMINISTRATIF' | 'VIE_SCOLAIRE' | 'SUPPORT';
}

export const PERSONNEL_POSITIONS: PersonnelPosition[] = [
  { code: 'DIRECTEUR', label: 'Directeur / Directrice', category: 'DIRECTION' },
  { code: 'DIRECTEUR_ADJOINT', label: 'Directeur adjoint', category: 'DIRECTION' },
  { code: 'CENSEUR', label: 'Censeur', category: 'DIRECTION' },
  { code: 'ENSEIGNANT', label: 'Enseignant / Professeur', category: 'ENSEIGNEMENT' },
  { code: 'ENSEIGNANT_TITULAIRE', label: 'Enseignant titulaire', category: 'ENSEIGNEMENT' },
  { code: 'ENSEIGNANT_VACATAIRE', label: 'Enseignant vacataire', category: 'ENSEIGNEMENT' },
  { code: 'SECRETAIRE', label: 'Secrétaire', category: 'ADMINISTRATIF' },
  { code: 'COMPTABLE', label: 'Comptable', category: 'ADMINISTRATIF' },
  { code: 'ECONOME', label: 'Économe / Intendant', category: 'ADMINISTRATIF' },
  { code: 'SURVEILLANT', label: 'Surveillant', category: 'VIE_SCOLAIRE' },
  { code: 'CONSEILLER_EDUCATION', label: "Conseiller principal d'éducation", category: 'VIE_SCOLAIRE' },
  { code: 'BIBLIOTHECAIRE', label: 'Bibliothécaire', category: 'VIE_SCOLAIRE' },
  { code: 'INFIRMIER', label: 'Infirmier scolaire', category: 'VIE_SCOLAIRE' },
  { code: 'AGENT_ENTRETIEN', label: "Agent d'entretien", category: 'SUPPORT' },
  { code: 'GARDIEN', label: 'Gardien / Agent de sécurité', category: 'SUPPORT' },
  { code: 'CHAUFFEUR', label: 'Chauffeur', category: 'SUPPORT' },
  { code: 'CUISINIER', label: 'Cuisinier / Personnel de cantine', category: 'SUPPORT' },
];
