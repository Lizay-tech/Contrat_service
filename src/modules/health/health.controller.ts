import type { Request, Response } from 'express';
import { sequelize } from '../../infrastructure/database/sequelize';
import { redisHealthy } from '../../infrastructure/redis/redis.client';
import { rabbitHealthy } from '../../infrastructure/messaging/rabbitmq';
import { env } from '../../shared/config/env';

async function dbHealthy(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
}

/** GET /health - etat du service et de ses dependances (DB, Redis, RabbitMQ). */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const [db, redisOk] = await Promise.all([dbHealthy(), redisHealthy()]);
  const rabbit = rabbitHealthy();
  const healthy = db && redisOk && rabbit;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      service: env.serviceName,
      status: healthy ? 'ok' : 'degraded',
      checks: { database: db, redis: redisOk, rabbitmq: rabbit },
      timestamp: new Date().toISOString(),
    },
  });
}
