import Redis from 'ioredis';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';

/**
 * Client Redis (contexte, cache permissions / annee scolaire).
 * lazyConnect: la connexion est etablie explicitement au demarrage.
 */
export const redis = new Redis(env.redis.url, {
  keyPrefix: env.redis.prefix,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: true,
});

redis.on('error', (err) => logger.error({ err }, '[redis] erreur'));

export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  await redis.connect();
  logger.info('[redis] Connexion etablie');
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'ready') {
    await redis.quit();
  }
}

export async function redisHealthy(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
