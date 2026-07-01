import { Umzug, SequelizeStorage } from 'umzug';
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
}
