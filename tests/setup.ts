/**
 * Global Jest setup. Integration tests need a reachable PostgreSQL configured
 * for the test database (see README > Tests). The `db.ts` helper applies the
 * schema + RLS and seeds reference data.
 */
import { sequelize } from '../src/infrastructure/database/sequelize';

jest.setTimeout(30000);

afterAll(async () => {
  await sequelize.close().catch(() => undefined);
});
