import Redis from 'ioredis';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logger';

export const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  db: env.redis.db,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  await redis.connect();
}
