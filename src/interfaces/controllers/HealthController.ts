import { Request, Response } from 'express';
import { Container } from '../../infrastructure/container';
import { sequelize } from '../../infrastructure/database/sequelize';
import { redis } from '../../infrastructure/redis/redisClient';
import { env } from '../../shared/config/env';

type Check = 'up' | 'down';

async function checkDb(): Promise<Check> {
  try {
    await sequelize.query('SELECT 1');
    return 'up';
  } catch {
    return 'down';
  }
}

async function checkRedis(): Promise<Check> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

export function makeHealthController(container: Container) {
  return {
    async health(_req: Request, res: Response): Promise<Response> {
      const [db, redisStatus] = await Promise.all([checkDb(), checkRedis()]);
      const rabbitmq: Check = container.events.isHealthy() ? 'up' : 'down';

      const healthy = db === 'up';
      const body = {
        success: healthy,
        data: {
          service: env.serviceName,
          status: healthy ? 'ok' : 'degraded',
          checks: { db, redis: redisStatus, rabbitmq },
          timestamp: new Date().toISOString(),
        },
      };
      return res.status(healthy ? 200 : 503).json(body);
    },
  };
}
