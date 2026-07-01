/**
 * Runs before any module import (jest `setupFiles`). Sets test defaults so that
 * env.ts picks them up. Values already present in the environment win (dotenv
 * does not override), letting CI point at a dedicated database.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.DB_NAME = process.env.DB_NAME ?? 'educa_contrat_service';
process.env.DB_USER = process.env.DB_USER ?? 'educa';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'educa';
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.EDUCA_SYSTEM_TENANT_ID =
  process.env.EDUCA_SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-0000000ed0ca';
