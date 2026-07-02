import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`[config] Variable d'environnement manquante: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function list(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  isTest: (process.env.NODE_ENV ?? 'development') === 'test',
  serviceName: process.env.SERVICE_NAME ?? 'contrat-service',
  port: int('PORT', 8091),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  logLevel: process.env.LOG_LEVEL ?? 'info',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: int('DB_PORT', 5432),
    name: required('DB_NAME', 'educa_contrat_service'),
    user: required('DB_USER', 'educa'),
    password: required('DB_PASSWORD', 'educa_secret'),
    ssl: bool('DB_SSL', false),
    poolMax: int('DB_POOL_MAX', 10),
    poolMin: int('DB_POOL_MIN', 0),
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    prefix: process.env.REDIS_PREFIX ?? 'contrat:',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://educa:educa@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'educa.contracts',
  },

  jwtSecret: required('JWT_SECRET', 'educa_access_secret_2026'),

  educaSystemTenantId:
    process.env.EDUCA_SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-000000000001',
  educaAdminRoles: list('EDUCA_ADMIN_ROLES', ['SUPER_ADMIN', 'EDUCA_ADMIN']),
  // Roles autorises a creer/publier des modeles de contrat.
  templateManagerRoles: list('TEMPLATE_MANAGER_ROLES', [
    'SCHOOL_ADMIN',
    'RESP_RH',
    'EDUCA_ADMIN',
    'SUPER_ADMIN',
  ]),

  storage: {
    uploadDir: process.env.UPLOAD_DIR ?? './storage/uploads',
    maxUploadMb: int('MAX_UPLOAD_MB', 25),
  },

  clients: {
    academicYearUrl: process.env.ACADEMIC_YEAR_SERVICE_URL ?? 'http://localhost:8082',
    signatureUrl: process.env.SIGNATURE_SERVICE_URL ?? 'http://localhost:8093',
    communicationUrl: process.env.COMMUNICATION_SERVICE_URL ?? 'http://localhost:8087',
    ecoleUrl: process.env.ECOLE_SERVICE_URL ?? 'http://localhost:3001',
    personnelUrl: process.env.ENSEIGNANT_SERVICE_URL ?? 'http://localhost:8083',
    affectationUrl: process.env.AFFECTATION_SERVICE_URL ?? 'http://localhost:8084',
    manageAccountUrl: process.env.MANAGE_ACCOUNT_SERVICE_URL ?? 'http://localhost:8081',
    // Optionnels (peuvent ne pas exister) -> fallback local si absents.
    rhUrl: process.env.RH_SERVICE_URL ?? '',
    configurationUrl: process.env.CONFIGURATION_SERVICE_URL ?? '',
  },
  // TTL (secondes) du cache Redis des donnees stables inter-services.
  aggregationCacheTtl: int('AGGREGATION_CACHE_TTL', 300),
} as const;

export type Env = typeof env;
