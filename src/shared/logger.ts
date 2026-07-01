import pino from 'pino';
import { env } from './config/env';

/**
 * Structured logger (pino). No pino-pretty in production.
 * Redaction guards against accidentally logging JWTs / auth headers.
 */
export const logger = pino({
  name: env.serviceName,
  level: env.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'authorization',
      'token',
      'jwt',
      'password',
    ],
    censor: '[REDACTED]',
  },
  transport:
    !env.isProduction && !env.isTest
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});

export type Logger = typeof logger;
