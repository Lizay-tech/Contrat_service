import type { QueryInterface } from 'sequelize';

/** Referentiel des types de contrat (PERSONNEL + ETABLISSEMENT). Idempotent. */
const TYPES: Array<{ code: string; label: string; scope: string; renewal: string }> = [
  // --- Personnel des etablissements ---
  { code: 'PERSONNEL_CDI', label: 'Contrat a duree indeterminee', scope: 'PERSONNEL', renewal: 'MANUAL' },
  { code: 'PERSONNEL_CDD', label: 'Contrat a duree determinee', scope: 'PERSONNEL', renewal: 'MANUAL' },
  { code: 'PERSONNEL_STAGE', label: 'Convention de stage', scope: 'PERSONNEL', renewal: 'MANUAL' },
  { code: 'PERSONNEL_VACATION', label: 'Contrat de vacation', scope: 'PERSONNEL', renewal: 'MANUAL' },
  { code: 'PERSONNEL_PRESTATION', label: 'Contrat de prestation de service', scope: 'PERSONNEL', renewal: 'MANUAL' },
  // --- Etablissement <-> EDUCA / Lizay ---
  { code: 'ETAB_ABONNEMENT', label: 'Abonnement plateforme (SaaS)', scope: 'ETABLISSEMENT', renewal: 'AUTO' },
  { code: 'ETAB_LICENCE', label: 'Licence logicielle', scope: 'ETABLISSEMENT', renewal: 'AUTO' },
  { code: 'ETAB_MAINTENANCE', label: 'Contrat de maintenance', scope: 'ETABLISSEMENT', renewal: 'AUTO' },
  { code: 'ETAB_ACCOMPAGNEMENT', label: 'Contrat d accompagnement', scope: 'ETABLISSEMENT', renewal: 'MANUAL' },
  { code: 'ETAB_PARTENARIAT', label: 'Accord de partenariat', scope: 'ETABLISSEMENT', renewal: 'MANUAL' },
  { code: 'ETAB_CGU', label: 'Conditions generales d utilisation', scope: 'ETABLISSEMENT', renewal: 'MANUAL' },
  { code: 'ETAB_DPA', label: 'Accord de traitement des donnees (DPA)', scope: 'ETABLISSEMENT', renewal: 'MANUAL' },
];

export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const values = TYPES.map(
    (t) =>
      `(gen_random_uuid(), '${t.code}', '${t.label}', '${t.scope}'::contract_scope, '${t.renewal}'::renewal_mode, TRUE, now(), now())`,
  ).join(',\n');

  await qi.sequelize.query(`
    INSERT INTO contract_types
      (id, code, label, scope, default_renewal_mode, active, created_at, updated_at)
    VALUES
      ${values}
    ON CONFLICT (code) DO NOTHING;
  `);
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  const codes = TYPES.map((t) => `'${t.code}'`).join(',');
  await qi.sequelize.query(`DELETE FROM contract_types WHERE code IN (${codes});`);
}
