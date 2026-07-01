import pino from 'pino';
import { env } from './env';

/**
 * Logger structure (pino). En production: JSON pur (pas de pino-pretty).
 * En dev/test: rendu lisible via pino-pretty (transport), jamais actif en prod.
 */
const transport =
  !env.isProduction && !env.isTest
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      }
    : undefined;

export const logger = pino({
  level: env.isTest ? 'silent' : env.logLevel,
  base: { service: env.serviceName },
  // Ne jamais logguer les secrets ni les donnees personnelles sensibles.
  redact: {
    paths: ['req.headers.authorization', 'authorization', 'token', 'jwt', 'password'],
    remove: true,
  },
  ...(transport ? { transport } : {}),
});

export type Logger = typeof logger;
