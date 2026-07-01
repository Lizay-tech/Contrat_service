import { createApp } from './app';
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
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    await Promise.allSettled([
      container.events.close(),
      redis.quit(),
      sequelize.close(),
    ]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal boot error');
  process.exit(1);
});
