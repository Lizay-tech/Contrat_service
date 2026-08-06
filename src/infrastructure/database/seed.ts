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
}
