import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  serviceName: process.env.SERVICE_NAME ?? 'contrat-service',
  port: int('PORT', 8091),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  publicDomain: process.env.PUBLIC_DOMAIN ?? 'contrat.educasoft.tech',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: int('DB_PORT', 5432),
    name: required('DB_NAME', 'educa_contrat_service'),
    user: required('DB_USER', 'educa'),
    password: required('DB_PASSWORD', 'educa'),
    poolMax: int('DB_POOL_MAX', 10),
    poolMin: int('DB_POOL_MIN', 0),
  },

  redis: {
    host: required('REDIS_HOST', 'localhost'),
    port: int('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: int('REDIS_DB', 0),
    anneeScolaireCacheTtl: int('ANNEE_SCOLAIRE_CACHE_TTL', 3600),
  },

  rabbitmq: {
    url: required('RABBITMQ_URL', 'amqp://educa:educa@localhost:5672'),
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'educa.contracts',
    exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE ?? 'topic',
  },

  jwt: {
    secret: required('JWT_SECRET', 'educa_access_secret_2026'),
    algorithm: (process.env.JWT_ALGORITHM ?? 'HS256') as 'HS256' | 'HS384' | 'HS512',
  },

  educa: {
    systemTenantId:
      process.env.EDUCA_SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-0000000ed0ca',
    adminRoles: (process.env.EDUCA_ADMIN_ROLES ?? 'SUPER_ADMIN,EDUCA_ADMIN')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean),
  },

  services: {
    anneeScolaireUrl: process.env.ANNEE_SCOLAIRE_SERVICE_URL ?? 'http://localhost:8082',
    manageAccountUrl: process.env.MANAGE_ACCOUNT_SERVICE_URL ?? 'http://localhost:8081',
    signatureUrl: process.env.SIGNATURE_SERVICE_URL ?? 'http://localhost:8093',
  },

  storage: {
    uploadDir: process.env.UPLOAD_DIR ?? './data/uploads',
    maxUploadSizeMb: int('MAX_UPLOAD_SIZE_MB', 25),
  },
} as const;

export type Env = typeof env;
