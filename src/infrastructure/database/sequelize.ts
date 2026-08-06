import { Sequelize } from 'sequelize';
import { env } from '../../shared/config/env';
<<<<<<< HEAD
import { logger } from '../../shared/logger';

/**
 * Single Sequelize instance for the service. The app connects as a NON-superuser
 * role so PostgreSQL Row Level Security is actually enforced (superusers and,
 * unless FORCE ROW LEVEL SECURITY is set, table owners bypass RLS).
=======
import { logger } from '../../shared/config/logger';

/**
 * Instance Sequelize unique (base dediee educa_contrat_service).
 * IMPORTANT: aucune synchronisation automatique au runtime (sync/alter interdit).
 * Le schema est gere exclusivement par les migrations (umzug).
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
 */
export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
<<<<<<< HEAD
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
=======
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
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
  },
});

export async function assertDatabaseConnection(): Promise<void> {
<<<<<<< HEAD
  // NEVER sync({ alter: true }) at runtime — migrations only.
  await sequelize.authenticate();
  logger.info('PostgreSQL connection established');
=======
  await sequelize.authenticate();
  logger.info('[db] Connexion PostgreSQL etablie');
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
}
