<<<<<<< HEAD
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
=======
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './sequelize';
import { logger } from '../../shared/config/logger';

const EXT = __filename.endsWith('.ts') ? 'ts' : 'js';

/** Runner de seeders (umzug), traque separement des migrations. */
export const seeder = new Umzug({
  migrations: { glob: [`seeders/*.${EXT}`, { cwd: __dirname }] },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, modelName: 'sequelize_seeder_meta' }),
  logger: console,
});

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'up';
  if (cmd === 'up') {
    const applied = await seeder.up();
    logger.info({ applied: applied.map((m) => m.name) }, '[seed] seeders appliques');
  } else if (cmd === 'down') {
    const reverted = await seeder.down();
    logger.info({ reverted: reverted.map((m) => m.name) }, '[seed] seeder annule');
  } else {
    throw new Error(`Commande inconnue: ${cmd} (up|down)`);
  }
  await sequelize.close();
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, '[seed] echec');
    process.exit(1);
  });
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
}
