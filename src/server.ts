import { createApp } from './app';
<<<<<<< HEAD
import { buildContainer } from './infrastructure/container';
import { assertDatabaseConnection, sequelize } from './infrastructure/database/sequelize';
import { connectRedis, redis } from './infrastructure/redis/redisClient';
import { env } from './shared/config/env';
import { logger } from './shared/logger';

async function bootstrap(): Promise<void> {
  const container = buildContainer();

  // Fail fast on the hard dependency (DB). RLS requires a working connection.
  await assertDatabaseConnection();

  // Soft dependencies: log but don't crash if momentarily unavailable.
  try {
    await connectRedis();
  } catch (err) {
    logger.warn({ err }, 'Redis not reachable at boot; will retry lazily');
  }
  try {
    await container.events.connect();
  } catch (err) {
    logger.warn({ err }, 'RabbitMQ not reachable at boot; will retry lazily');
  }

  const app = createApp(container);
  const server = app.listen(env.port, () => {
    logger.info(
      { port: env.port, domain: env.publicDomain, env: env.nodeEnv },
      `${env.serviceName} listening`,
=======
import { env } from './shared/config/env';
import { logger } from './shared/config/logger';
import { assertDatabaseConnection, sequelize } from './infrastructure/database/sequelize';
import { connectRedis, disconnectRedis } from './infrastructure/redis/redis.client';
import {
  connectRabbitMQ,
  disconnectRabbitMQ,
} from './infrastructure/messaging/rabbitmq';
import { ensureStorageReady } from './infrastructure/storage/file-storage';
import { closePdfBrowser } from './infrastructure/pdf/html-pdf';

async function bootstrap(): Promise<void> {
  // Verifie la connexion DB (jamais de sync/alter au runtime).
  await assertDatabaseConnection();
  await ensureStorageReady();

  // Dependances non bloquantes: on log mais on ne bloque pas le demarrage.
  try {
    await connectRedis();
  } catch (err) {
    logger.error({ err }, '[boot] Redis indisponible au demarrage');
  }
  try {
    await connectRabbitMQ();
  } catch (err) {
    logger.error({ err }, '[boot] RabbitMQ indisponible au demarrage');
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(
      { port: env.port, env: env.nodeEnv, prefix: env.apiPrefix },
      `[boot] ${env.serviceName} demarre`,
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
<<<<<<< HEAD
    logger.info({ signal }, 'Shutting down');
    server.close();
    await Promise.allSettled([
      container.events.close(),
      redis.quit(),
      sequelize.close(),
    ]);
=======
    logger.info({ signal }, '[shutdown] arret en cours');
    server.close();
    await closePdfBrowser();
    await disconnectRabbitMQ();
    await disconnectRedis();
    await sequelize.close();
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
<<<<<<< HEAD
  logger.error({ err }, 'Fatal boot error');
=======
  logger.error({ err }, '[boot] echec du demarrage');
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
  process.exit(1);
});
