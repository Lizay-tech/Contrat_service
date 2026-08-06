import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
<<<<<<< HEAD
    throw new Error(`Missing required environment variable: ${name}`);
=======
    throw new Error(`[config] Variable d'environnement manquante: ${name}`);
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
<<<<<<< HEAD
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
=======
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
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3

  db: {
    host: required('DB_HOST', 'localhost'),
    port: int('DB_PORT', 5432),
    name: required('DB_NAME', 'educa_contrat_service'),
    user: required('DB_USER', 'educa'),
<<<<<<< HEAD
    password: required('DB_PASSWORD', 'educa'),
=======
    password: required('DB_PASSWORD', 'educa_secret'),
    ssl: bool('DB_SSL', false),
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
    poolMax: int('DB_POOL_MAX', 10),
    poolMin: int('DB_POOL_MIN', 0),
  },

  redis: {
<<<<<<< HEAD
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
=======
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
    affectationUrl: process.env.AFFECTATION_SERVICE_URL ?? 'http://localhost:3006',
    manageAccountUrl: process.env.MANAGE_ACCOUNT_SERVICE_URL ?? 'http://localhost:8081',
    // Optionnels (peuvent ne pas exister) -> fallback local si absents.
    rhUrl: process.env.RH_SERVICE_URL ?? '',
    configurationUrl: process.env.CONFIGURATION_SERVICE_URL ?? '',
  },
  // TTL (secondes) du cache Redis des donnees stables inter-services.
  aggregationCacheTtl: int('AGGREGATION_CACHE_TTL', 300),
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
} as const;

export type Env = typeof env;
