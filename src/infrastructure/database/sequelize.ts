import { Sequelize } from 'sequelize';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logger';

/**
 * Single Sequelize instance for the service. The app connects as a NON-superuser
 * role so PostgreSQL Row Level Security is actually enforced (superusers and,
 * unless FORCE ROW LEVEL SECURITY is set, table owners bypass RLS).
 */
export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.isProduction
    ? false
    : (msg: string) => logger.debug({ sql: msg }, 'sequelize'),
  pool: {
    max: env.db.poolMax,
    min: env.db.poolMin,
    idle: 10000,
    acquire: 30000,
  },
  define: {
    underscored: true,
    freezeTableName: true,
    timestamps: true,
    paranoid: true, // soft-delete via deleted_at
  },
});

export async function assertDatabaseConnection(): Promise<void> {
  // NEVER sync({ alter: true }) at runtime — migrations only.
  await sequelize.authenticate();
  logger.info('PostgreSQL connection established');
}
