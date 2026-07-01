import { QueryInterface } from 'sequelize';

/**
 * Phase >= 2 tables are RESERVED here (created with a minimal tenant-scoped
 * skeleton + RLS) so their names exist and the schema evolves additively later.
 * NO business logic is implemented against them in Phase 1.
 */
const RESERVED_TABLES = [
  'contract_versions',
  'contract_templates',
  'template_versions',
  'clauses',
  'clause_categories',
  'template_clauses',
  'signature_requests',
  'signatories',
  'signatures',
  'workflows',
  'workflow_steps',
  'approval_requests',
  'approvals',
  'renewals',
  'amendments',
  'terminations',
  'obligations',
  'reminders',
  'notifications',
  'contract_financials',
  'payment_schedules',
  'disputes',
  'legal_validations',
  'contract_acl',
  'search_index',
];

export async function up({ context: q }: { context: QueryInterface }): Promise<void> {
  const sql = q.sequelize;
  for (const table of RESERVED_TABLES) {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_school_id uuid NOT NULL,
        contract_id      uuid,
        metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now(),
        deleted_at       timestamptz
      );
      ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation ON ${table};
      CREATE POLICY tenant_isolation ON ${table}
        USING (tenant_school_id = current_setting('app.tenant_school_id', true)::uuid)
        WITH CHECK (tenant_school_id = current_setting('app.tenant_school_id', true)::uuid);
    `);
  }
}

export async function down({ context: q }: { context: QueryInterface }): Promise<void> {
  const sql = q.sequelize;
  for (const table of RESERVED_TABLES) {
    await sql.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
  }
}
