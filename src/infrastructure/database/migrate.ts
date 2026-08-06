import { Umzug, SequelizeStorage } from 'umzug';
<<<<<<< HEAD
import { QueryInterface } from 'sequelize';
import { sequelize } from './sequelize';
import { logger } from '../../shared/logger';

export type MigrationContext = QueryInterface;

export const umzug = new Umzug<MigrationContext>({
  migrations: {
    glob: ['../../migrations/*.{ts,js}', { cwd: __dirname }],
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
  logger: {
    info: (m) => logger.info(m),
    warn: (m) => logger.warn(m),
    error: (m) => logger.error(m),
    debug: (m) => logger.debug(m),
  },
});

export type Migration = typeof umzug._types.migration;

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'up';
  try {
    if (cmd === 'up') {
      const applied = await umzug.up();
      logger.info({ applied: applied.map((m) => m.name) }, 'Migrations applied');
    } else if (cmd === 'down') {
      const reverted = await umzug.down();
      logger.info({ reverted: reverted.map((m) => m.name) }, 'Migration reverted');
    } else {
      throw new Error(`Unknown migrate command: ${cmd}`);
    }
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    await sequelize.close();
    process.exit(1);
  }
}

// Run only when invoked directly (npm run migrate).
if (require.main === module) {
  void main();
=======
import { sequelize } from './sequelize';
import { logger } from '../../shared/config/logger';

// En dev, __filename est un .ts (ts-node); en prod, un .js (dist compile).
const EXT = __filename.endsWith('.ts') ? 'ts' : 'js';

/** Runner de migrations (umzug). Jamais de sync/alter automatique. */
export const migrator = new Umzug({
  migrations: { glob: [`migrations/*.${EXT}`, { cwd: __dirname }] },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, modelName: 'sequelize_meta' }),
  logger: console,
});

export type Migration = typeof migrator._types.migration;

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'up';
  if (cmd === 'up') {
    const applied = await migrator.up();
    logger.info({ applied: applied.map((m) => m.name) }, '[migrate] migrations appliquees');
  } else if (cmd === 'down') {
    const reverted = await migrator.down();
    logger.info({ reverted: reverted.map((m) => m.name) }, '[migrate] migration annulee');
  } else {
    throw new Error(`Commande inconnue: ${cmd} (up|down)`);
  }
  await sequelize.close();
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, '[migrate] echec');
    process.exit(1);
  });
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
}
