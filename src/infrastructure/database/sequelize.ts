import { Sequelize } from 'sequelize';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';

/**
 * Instance Sequelize unique (base dediee educa_contrat_service).
 * IMPORTANT: aucune synchronisation automatique au runtime (sync/alter interdit).
 * Le schema est gere exclusivement par les migrations (umzug).
 */
export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.isProduction || env.isTest ? false : (msg) => logger.debug(msg),
  pool: { max: env.db.poolMax, min: env.db.poolMin, acquire: 30000, idle: 10000 },
  dialectOptions: env.db.ssl
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  define: {
    underscored: true,
    timestamps: true,
    paranoid: true, // soft-delete via deleted_at partout
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  },
});

export async function assertDatabaseConnection(): Promise<void> {
  await sequelize.authenticate();
  logger.info('[db] Connexion PostgreSQL etablie');
}
