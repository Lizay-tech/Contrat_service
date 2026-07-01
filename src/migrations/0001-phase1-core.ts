import { QueryInterface } from 'sequelize';

/**
 * Phase 1 core schema: reference data, contracts and their satellites, immutable
 * audit, per-tenant numbering sequence — with PostgreSQL Row Level Security
 * (FORCE, so even the table owner is subject to the tenant policy) on every
 * business table.
 *
 * NOTE: the application MUST connect as a NON-superuser role; superusers always
 * bypass RLS regardless of FORCE.
 */
export async function up({ context: q }: { context: QueryInterface }): Promise<void> {
  const sql = q.sequelize;

  // Extensions (uuid generation available if ever needed at the DB level).
  await sql.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  // --- Enum types ---
  await sql.query(`
    DO $$ BEGIN
      CREATE TYPE contract_scope AS ENUM ('PERSONNEL','ETABLISSEMENT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE contract_status AS ENUM (
        'DRAFT','PENDING_APPROVAL','APPROVED','PENDING_SIGNATURE','ACTIVE',
        'AMENDED','EXPIRING','RENEWED','EXPIRED','TERMINATED','CANCELLED','ARCHIVED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE renewal_mode AS ENUM ('AUTO','MANUAL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE party_type AS ENUM ('PERSON','SCHOOL','ORG');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE role_in_contract AS ENUM (
        'EMPLOYEUR','EMPLOYE','PRESTATAIRE','CLIENT','FOURNISSEUR','TEMOIN'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE document_type AS ENUM ('ORIGINAL','ANNEXE','SIGNE');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // --- contract_types (GLOBAL reference data: no tenant, no RLS) ---
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_types (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code                 varchar(64) NOT NULL UNIQUE,
      label                varchar(255) NOT NULL,
      scope                contract_scope NOT NULL,
      default_renewal_mode renewal_mode NOT NULL DEFAULT 'MANUAL',
      active               boolean NOT NULL DEFAULT true,
      created_at           timestamptz NOT NULL DEFAULT now(),
      updated_at           timestamptz NOT NULL DEFAULT now(),
      deleted_at           timestamptz
    );
    CREATE INDEX IF NOT EXISTS ix_contract_types_scope ON contract_types (scope);
  `);

  // --- contracts ---
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id  uuid NOT NULL,
      subject_school_id uuid,
      annee_scolaire_id uuid,
      contract_number   varchar(64) NOT NULL,
      contract_type_id  uuid NOT NULL REFERENCES contract_types (id),
      scope             contract_scope NOT NULL,
      status            contract_status NOT NULL DEFAULT 'DRAFT',
      start_date        date,
      end_date          date,
      duration_days     integer,
      trial_period_days integer,
      amount            numeric(14,2),
      currency          varchar(3) NOT NULL DEFAULT 'HTG',
      renewal_mode      renewal_mode NOT NULL DEFAULT 'MANUAL',
      owner_user_id     uuid NOT NULL,
      title             varchar(255) NOT NULL,
      metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now(),
      deleted_at        timestamptz
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_tenant_number
      ON contracts (tenant_school_id, contract_number);
    CREATE INDEX IF NOT EXISTS ix_contracts_tenant_status
      ON contracts (tenant_school_id, status);
    CREATE INDEX IF NOT EXISTS ix_contracts_tenant_scope
      ON contracts (tenant_school_id, scope);
    CREATE INDEX IF NOT EXISTS ix_contracts_subject_school
      ON contracts (subject_school_id);
    CREATE INDEX IF NOT EXISTS ix_contracts_type
      ON contracts (contract_type_id);
  `);

  // --- contract_parties ---
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_parties (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id uuid NOT NULL,
      contract_id      uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      party_type       party_type NOT NULL,
      person_user_id   uuid,
      school_id        uuid,
      role_in_contract role_in_contract NOT NULL,
      full_name        varchar(255) NOT NULL,
      email            varchar(255),
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now(),
      deleted_at       timestamptz
    );
    CREATE INDEX IF NOT EXISTS ix_parties_contract ON contract_parties (contract_id);
    CREATE INDEX IF NOT EXISTS ix_parties_tenant ON contract_parties (tenant_school_id);
  `);

  // --- contract_documents ---
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_documents (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id uuid NOT NULL,
      contract_id      uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      type             document_type NOT NULL,
      file_path        varchar(1024) NOT NULL,
      mime_type        varchar(128) NOT NULL,
      size_bytes       bigint NOT NULL,
      sha256_hash      varchar(64) NOT NULL,
      version          integer NOT NULL DEFAULT 1,
      uploaded_by      uuid NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now(),
      deleted_at       timestamptz
    );
    CREATE INDEX IF NOT EXISTS ix_documents_contract ON contract_documents (contract_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_contract_version
      ON contract_documents (contract_id, version);
  `);

  // --- contract_status_history ---
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_status_history (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id uuid NOT NULL,
      contract_id      uuid NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      from_status      contract_status,
      to_status        contract_status NOT NULL,
      changed_by       uuid NOT NULL,
      reason           text,
      changed_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_status_history_contract
      ON contract_status_history (contract_id, changed_at);
  `);

  // --- audit_logs (append-only / immutable) ---
  await sql.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id uuid NOT NULL,
      entity_type      varchar(64) NOT NULL,
      entity_id        uuid NOT NULL,
      action           varchar(64) NOT NULL,
      actor_user_id    uuid,
      payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
      ip               varchar(64),
      created_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_logs (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS ix_audit_tenant ON audit_logs (tenant_school_id, created_at);
  `);

  // Immutability: block UPDATE/DELETE on audit_logs at the DB level.
  await sql.query(`
    CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs is immutable (% not allowed)', TG_OP;
    END; $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
    CREATE TRIGGER trg_audit_logs_immutable
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
  `);

  // --- contract_sequences (per-tenant monotonic numbering) ---
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_sequences (
      tenant_school_id uuid PRIMARY KEY,
      last_value       bigint NOT NULL DEFAULT 0
    );
  `);

  // --- Row Level Security on every tenant table (FORCE => owner too) ---
  const tenantTables = [
    'contracts',
    'contract_parties',
    'contract_documents',
    'contract_status_history',
    'audit_logs',
    'contract_sequences',
  ];
  for (const table of tenantTables) {
    await sql.query(`
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
  await sql.query('DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;');
  await sql.query('DROP FUNCTION IF EXISTS audit_logs_block_mutation();');
  await sql.query(`
    DROP TABLE IF EXISTS contract_sequences CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS contract_status_history CASCADE;
    DROP TABLE IF EXISTS contract_documents CASCADE;
    DROP TABLE IF EXISTS contract_parties CASCADE;
    DROP TABLE IF EXISTS contracts CASCADE;
    DROP TABLE IF EXISTS contract_types CASCADE;
  `);
  await sql.query(`
    DROP TYPE IF EXISTS document_type;
    DROP TYPE IF EXISTS role_in_contract;
    DROP TYPE IF EXISTS party_type;
    DROP TYPE IF EXISTS renewal_mode;
    DROP TYPE IF EXISTS contract_status;
    DROP TYPE IF EXISTS contract_scope;
  `);
}
