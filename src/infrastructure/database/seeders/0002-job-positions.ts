import type { QueryInterface } from 'sequelize';

/** Catalogue des postes du personnel (referentiel global). Idempotent. */
const POSITIONS: Array<{ code: string; label: string; category: string }> = [
  { code: 'DIRECTEUR', label: 'Directeur / Directrice', category: 'DIRECTION' },
  { code: 'DIRECTEUR_ADJOINT', label: 'Directeur adjoint', category: 'DIRECTION' },
  { code: 'CENSEUR', label: 'Censeur', category: 'DIRECTION' },
  { code: 'ENSEIGNANT', label: 'Enseignant / Professeur', category: 'PEDAGOGIE' },
  { code: 'CONSEILLER_PEDAGOGIQUE', label: 'Conseiller pedagogique', category: 'PEDAGOGIE' },
  { code: 'SURVEILLANT', label: 'Surveillant', category: 'PEDAGOGIE' },
  { code: 'BIBLIOTHECAIRE', label: 'Bibliothecaire', category: 'PEDAGOGIE' },
  { code: 'SECRETAIRE', label: 'Secretaire', category: 'ADMINISTRATION' },
  { code: 'COMPTABLE', label: 'Comptable', category: 'ADMINISTRATION' },
  { code: 'ECONOME', label: 'Econome', category: 'ADMINISTRATION' },
  { code: 'INFIRMIER', label: 'Infirmier / Infirmiere', category: 'SUPPORT' },
  { code: 'AGENT_ENTRETIEN', label: 'Agent d entretien', category: 'SUPPORT' },
  { code: 'GARDIEN', label: 'Gardien', category: 'SUPPORT' },
  { code: 'CHAUFFEUR', label: 'Chauffeur', category: 'SUPPORT' },
];

export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const values = POSITIONS.map(
    (p) => `(gen_random_uuid(), '${p.code}', '${p.label}', '${p.category}', TRUE, now(), now())`,
  ).join(',\n');

  await qi.sequelize.query(`
    INSERT INTO job_positions (id, code, label, category, active, created_at, updated_at)
    VALUES
      ${values}
    ON CONFLICT (code) DO NOTHING;
  `);
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  const codes = POSITIONS.map((p) => `'${p.code}'`).join(',');
  await qi.sequelize.query(`DELETE FROM job_positions WHERE code IN (${codes});`);
}
