<<<<<<< HEAD
/**
 * Global Jest setup. Integration tests need a reachable PostgreSQL configured
 * for the test database (see README > Tests). The `db.ts` helper applies the
 * schema + RLS and seeds reference data.
 */
import { sequelize } from '../src/infrastructure/database/sequelize';

jest.setTimeout(30000);

afterAll(async () => {
  await sequelize.close().catch(() => undefined);
=======
// Force l'environnement de test AVANT tout import applicatif (env.ts lit process.env).
process.env.NODE_ENV = 'test';
process.env.EDUCA_SYSTEM_TENANT_ID =
  process.env.EDUCA_SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

jest.setTimeout(30000);

// Ferme le navigateur Puppeteer (singleton) en fin de chaque suite.
afterAll(async () => {
  const { closePdfBrowser } = await import('../src/infrastructure/pdf/html-pdf');
  await closePdfBrowser();
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
});
