import type { QueryInterface } from 'sequelize';

/**
 * Phase 2 - Templates de contrat, versions, clauses + extension de contracts.
 *
 * RLS: les modeles/versions PREDEFINED appartiennent au tenant systeme mais
 * restent LISIBLES par tous les tenants (policy speciale scope_owner/is_predefined).
 * L'ecriture reste limitee au tenant proprietaire (WITH CHECK tenant = session).
 */
export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;

  await sql.query(`
    DO $$ BEGIN
      CREATE TYPE template_scope_owner AS ENUM ('PREDEFINED','SCHOOL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE template_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_templates (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID,
      scope_owner      template_scope_owner NOT NULL,
      contract_type_id UUID REFERENCES contract_types(id),
      name             VARCHAR(255) NOT NULL,
      description      TEXT,
      status           template_status NOT NULL DEFAULT 'DRAFT',
      current_version  INTEGER NOT NULL DEFAULT 0,
      created_by       UUID,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at       TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS templates_owner_type_idx
      ON contract_templates (scope_owner, contract_type_id);
    CREATE INDEX IF NOT EXISTS templates_tenant_idx ON contract_templates (tenant_school_id);
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS template_versions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID,
      is_predefined    BOOLEAN NOT NULL DEFAULT FALSE,
      template_id      UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
      version          INTEGER NOT NULL,
      body             TEXT NOT NULL,
      header           TEXT,
      footer           TEXT,
      variables        JSONB NOT NULL DEFAULT '[]'::jsonb,
      changelog        TEXT,
      published_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS template_versions_tpl_version_uq
      ON template_versions (template_id, version);
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS clauses (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID,
      category         VARCHAR(128) NOT NULL,
      title            VARCHAR(255) NOT NULL,
      body             TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      active           BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at       TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS clauses_tenant_category_idx
      ON clauses (tenant_school_id, category);

    CREATE TABLE IF NOT EXISTS template_clauses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
      clause_id   UUID NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS template_clauses_tpl_pos_idx
      ON template_clauses (template_id, position);
  `);

  // Extension de contracts.
  await sql.query(`
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS template_id UUID;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS template_version INTEGER;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS rendered_body TEXT;
  `);

  // ----- RLS -----
  const tenant = `tenant_school_id = current_setting('app.tenant_school_id', true)::uuid`;

  // contract_templates: lecture des PREDEFINED par tous; ecriture reservee au tenant.
  await sql.query(`
    ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE contract_templates FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS templates_read ON contract_templates;
    DROP POLICY IF EXISTS templates_write ON contract_templates;
    CREATE POLICY templates_read ON contract_templates
      FOR SELECT USING (scope_owner = 'PREDEFINED' OR ${tenant});
    CREATE POLICY templates_write ON contract_templates
      FOR ALL USING (${tenant}) WITH CHECK (${tenant});
  `);

  // template_versions: lecture des versions PREDEFINED par tous.
  await sql.query(`
    ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE template_versions FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS template_versions_read ON template_versions;
    DROP POLICY IF EXISTS template_versions_write ON template_versions;
    CREATE POLICY template_versions_read ON template_versions
      FOR SELECT USING (is_predefined = TRUE OR ${tenant});
    CREATE POLICY template_versions_write ON template_versions
      FOR ALL USING (${tenant}) WITH CHECK (${tenant});
  `);

  // clauses: isolation stricte par tenant.
  await sql.query(`
    ALTER TABLE clauses ENABLE ROW LEVEL SECURITY;
    ALTER TABLE clauses FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS clauses_isolation ON clauses;
    CREATE POLICY clauses_isolation ON clauses
      FOR ALL USING (${tenant}) WITH CHECK (${tenant});
  `);
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;
  await sql.query(`
    ALTER TABLE contracts DROP COLUMN IF EXISTS rendered_body;
    ALTER TABLE contracts DROP COLUMN IF EXISTS template_version;
    ALTER TABLE contracts DROP COLUMN IF EXISTS template_id;
    DROP TABLE IF EXISTS template_clauses CASCADE;
    DROP TABLE IF EXISTS clauses CASCADE;
    DROP TABLE IF EXISTS template_versions CASCADE;
    DROP TABLE IF EXISTS contract_templates CASCADE;
    DROP TYPE IF EXISTS template_status;
    DROP TYPE IF EXISTS template_scope_owner;
  `);
}
