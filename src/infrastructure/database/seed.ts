import { QueryTypes } from 'sequelize';
import { sequelize } from './sequelize';
import { logger } from '../../shared/logger';
import { CONTRACT_TYPE_SEED } from '../../seeders/contract-types.seed';
import { PERSONNEL_POSITIONS } from '../../seeders/personnel-positions.seed';

/**
 * Idempotent seeding of reference data. contract_types is a global (non-RLS)
 * catalogue so it can be upserted directly. Re-running is safe (ON CONFLICT).
 */
export async function seed(): Promise<void> {
  for (const t of CONTRACT_TYPE_SEED) {
    await sequelize.query(
      `INSERT INTO contract_types (id, code, label, scope, default_renewal_mode, active)
       VALUES (gen_random_uuid(), :code, :label, :scope, :mode, true)
       ON CONFLICT (code) DO UPDATE
         SET label = EXCLUDED.label,
             scope = EXCLUDED.scope,
             default_renewal_mode = EXCLUDED.default_renewal_mode,
             active = true,
             updated_at = now();`,
      {
        replacements: {
          code: t.code,
          label: t.label,
          scope: t.scope,
          mode: t.defaultRenewalMode,
        },
        type: QueryTypes.INSERT,
      },
    );
  }

  logger.info(
    { contractTypes: CONTRACT_TYPE_SEED.length, positions: PERSONNEL_POSITIONS.length },
    'Reference data seeded (personnel positions are static reference data)',
  );
}

if (require.main === module) {
  seed()
    .then(() => sequelize.close())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Seeding failed');
      void sequelize.close();
      process.exit(1);
    });
}
