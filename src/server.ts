import { createApp } from './app';
import { env } from './shared/config/env';
import { logger } from './shared/config/logger';
import { assertDatabaseConnection, sequelize } from './infrastructure/database/sequelize';
import { connectRedis, disconnectRedis } from './infrastructure/redis/redis.client';
import {
  connectRabbitMQ,
  disconnectRabbitMQ,
} from './infrastructure/messaging/rabbitmq';
import { ensureStorageReady } from './infrastructure/storage/file-storage';

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
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, '[shutdown] arret en cours');
    server.close();
    await disconnectRabbitMQ();
    await disconnectRedis();
    await sequelize.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, '[boot] echec du demarrage');
  process.exit(1);
});
