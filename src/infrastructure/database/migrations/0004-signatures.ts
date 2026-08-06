import type { QueryInterface } from 'sequelize';

/** Phase 2 - Suivi local des demandes de signature et des signataires (+ RLS). */
export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;

  await sql.query(`
    DO $$ BEGIN
      CREATE TYPE signature_mode AS ENUM ('SEQUENTIAL','PARALLEL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE signature_request_status AS ENUM ('PENDING','COMPLETED','CANCELLED','EXPIRED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE signatory_status AS ENUM ('PENDING','SIGNED','REFUSED','EXPIRED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE signature_type AS ENUM ('TEXT','DRAWN');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS signature_requests (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID NOT NULL,
      contract_id      UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      mode             signature_mode NOT NULL,
      status           signature_request_status NOT NULL DEFAULT 'PENDING',
      deadline         DATE,
      external_ref     VARCHAR(255),
      created_by       UUID NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS sig_requests_tenant_contract_idx
      ON signature_requests (tenant_school_id, contract_id);

    CREATE TABLE IF NOT EXISTS signatories (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID NOT NULL,
      request_id       UUID NOT NULL REFERENCES signature_requests(id) ON DELETE CASCADE,
      contract_id      UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      order_index      INTEGER NOT NULL DEFAULT 0,
      user_id          UUID,
      name             VARCHAR(255) NOT NULL,
      email            VARCHAR(255) NOT NULL,
      status           signatory_status NOT NULL DEFAULT 'PENDING',
      signature_type   signature_type,
      signed_at        TIMESTAMPTZ,
      ip               VARCHAR(64),
      device           VARCHAR(512),
      signature_ref    VARCHAR(255),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS signatories_tenant_request_idx
      ON signatories (tenant_school_id, request_id);
  `);

  const tenant = `tenant_school_id = current_setting('app.tenant_school_id', true)::uuid`;
  for (const table of ['signature_requests', 'signatories']) {
    await sql.query(`
      ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS ${table}_isolation ON ${table};
      CREATE POLICY ${table}_isolation ON ${table}
        FOR ALL USING (${tenant}) WITH CHECK (${tenant});
    `);
  }
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;
  await sql.query(`
    DROP TABLE IF EXISTS signatories CASCADE;
    DROP TABLE IF EXISTS signature_requests CASCADE;
    DROP TYPE IF EXISTS signature_type;
    DROP TYPE IF EXISTS signatory_status;
    DROP TYPE IF EXISTS signature_request_status;
    DROP TYPE IF EXISTS signature_mode;
  `);
}
