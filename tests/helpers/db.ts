import { QueryTypes } from 'sequelize';
import { sequelize } from '../../src/infrastructure/database/sequelize';
import { up as up1 } from '../../src/migrations/0001-phase1-core';
import { up as up2 } from '../../src/migrations/0002-phase2-reserved';
import { seed } from '../../src/infrastructure/database/seed';

/**
 * Applies the schema directly (bypassing umzug's dynamic .ts import, which
 * ts-jest doesn't transform) and seeds reference data. Idempotent.
 */
export async function prepareDatabase(): Promise<void> {
  const qi = sequelize.getQueryInterface();
  await up1({ context: qi });
  await up2({ context: qi });
  await seed();
}

/** Truncates all tenant tables between tests (table owner bypasses RLS on TRUNCATE). */
export async function truncateAll(): Promise<void> {
  await sequelize.query(
    `TRUNCATE TABLE
       contract_documents,
       contract_parties,
       contract_status_history,
       audit_logs,
       contract_sequences,
       contracts
     RESTART IDENTITY CASCADE;`,
    { type: QueryTypes.RAW },
  );
}

/** Fetches a seeded contract type id by code. */
export async function contractTypeIdByCode(code: string): Promise<string> {
  const rows = await sequelize.query<{ id: string }>(
    'SELECT id FROM contract_types WHERE code = :code LIMIT 1',
    { replacements: { code }, type: QueryTypes.SELECT },
  );
  if (!rows[0]) throw new Error(`Seeded contract type ${code} not found`);
  return rows[0].id;
}
