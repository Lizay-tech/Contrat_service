import type { QueryInterface } from 'sequelize';

/**
 * Row Level Security multi-tenant.
 *
 * Chaque table metier est filtree par tenant_school_id = app.tenant_school_id
 * (parametre de session pose par requete via SET LOCAL). FORCE ROW LEVEL SECURITY
 * garantit que la policy s'applique MEME au proprietaire des tables (role applicatif).
 *
 * audit_logs et contract_status_history: append-only (SELECT + INSERT seulement,
 * pas de policy UPDATE/DELETE => ces operations sont refusees => immuabilite).
 */
const TENANT_MATCH = `tenant_school_id = current_setting('app.tenant_school_id', true)::uuid`;

export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;

  // Tables a CRUD complet filtre par tenant.
  for (const table of ['contracts', 'contract_parties', 'contract_documents']) {
    await sql.query(`
      ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table};
      CREATE POLICY ${table}_tenant_isolation ON ${table}
        FOR ALL
        USING (${TENANT_MATCH})
        WITH CHECK (${TENANT_MATCH});
    `);
  }

  // Tables append-only (immuables).
  for (const table of ['contract_status_history', 'audit_logs']) {
    await sql.query(`
      ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS ${table}_tenant_select ON ${table};
      DROP POLICY IF EXISTS ${table}_tenant_insert ON ${table};
      CREATE POLICY ${table}_tenant_select ON ${table}
        FOR SELECT USING (${TENANT_MATCH});
      CREATE POLICY ${table}_tenant_insert ON ${table}
        FOR INSERT WITH CHECK (${TENANT_MATCH});
    `);
  }
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;
  for (const table of [
    'contracts',
    'contract_parties',
    'contract_documents',
    'contract_status_history',
    'audit_logs',
  ]) {
    await sql.query(`
      DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table};
      DROP POLICY IF EXISTS ${table}_tenant_select ON ${table};
      DROP POLICY IF EXISTS ${table}_tenant_insert ON ${table};
      ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY;
      ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;
    `);
  }
}
