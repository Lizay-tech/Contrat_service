import type { QueryInterface } from 'sequelize';

/**
 * Schema initial Phase 1. DDL explicite (enums natifs, index nommes < 63 car.).
 * Aucune synchronisation Sequelize: ce fichier est l'autorite sur le schema.
 */
export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;

  await sql.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // ----- Types ENUM -----
  await sql.query(`
    DO $$ BEGIN
      CREATE TYPE contract_scope AS ENUM ('PERSONNEL', 'ETABLISSEMENT');
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
      CREATE TYPE role_in_contract AS ENUM
        ('EMPLOYEUR','EMPLOYE','PRESTATAIRE','CLIENT','FOURNISSEUR','TEMOIN');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE document_type AS ENUM ('ORIGINAL','ANNEXE','SIGNE');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // ----- contract_types (referentiel global, pas de tenant) -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_types (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code                 VARCHAR(64) NOT NULL UNIQUE,
      label                VARCHAR(255) NOT NULL,
      scope                contract_scope NOT NULL,
      default_renewal_mode renewal_mode NOT NULL DEFAULT 'MANUAL',
      active               BOOLEAN NOT NULL DEFAULT TRUE,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at           TIMESTAMPTZ
    );
  `);

  // ----- job_positions (catalogue des postes du personnel, global) -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS job_positions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code       VARCHAR(64) NOT NULL UNIQUE,
      label      VARCHAR(255) NOT NULL,
      category   VARCHAR(64) NOT NULL,
      active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
  `);

  // ----- contracts -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id  UUID NOT NULL,
      subject_school_id UUID,
      annee_scolaire_id UUID,
      contract_number   VARCHAR(64) NOT NULL,
      contract_type_id  UUID NOT NULL REFERENCES contract_types(id),
      status            contract_status NOT NULL DEFAULT 'DRAFT',
      title             VARCHAR(255) NOT NULL,
      start_date        DATE,
      end_date          DATE,
      duration_days     INTEGER,
      trial_period_days INTEGER,
      amount            NUMERIC(14,2),
      currency          VARCHAR(3) NOT NULL DEFAULT 'HTG',
      renewal_mode      renewal_mode NOT NULL DEFAULT 'MANUAL',
      owner_user_id     UUID NOT NULL,
      metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at        TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS contracts_tenant_number_uq
      ON contracts (tenant_school_id, contract_number) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS contracts_tenant_status_idx
      ON contracts (tenant_school_id, status);
    CREATE INDEX IF NOT EXISTS contracts_subject_school_idx ON contracts (subject_school_id);
    CREATE INDEX IF NOT EXISTS contracts_type_idx ON contracts (contract_type_id);
  `);

  // ----- contract_parties -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_parties (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID NOT NULL,
      contract_id      UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      party_type       party_type NOT NULL,
      person_user_id   UUID,
      school_id        UUID,
      role_in_contract role_in_contract NOT NULL,
      full_name        VARCHAR(255) NOT NULL,
      email            VARCHAR(255),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at       TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS parties_tenant_contract_idx
      ON contract_parties (tenant_school_id, contract_id);
  `);

  // ----- contract_documents -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_documents (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID NOT NULL,
      contract_id      UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      type             document_type NOT NULL,
      file_path        VARCHAR(1024) NOT NULL,
      original_name    VARCHAR(512) NOT NULL,
      mime_type        VARCHAR(128) NOT NULL,
      size_bytes       BIGINT NOT NULL,
      sha256_hash      VARCHAR(64) NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      uploaded_by      UUID NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at       TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS documents_tenant_contract_idx
      ON contract_documents (tenant_school_id, contract_id);
    CREATE INDEX IF NOT EXISTS documents_sha256_idx ON contract_documents (sha256_hash);
  `);

  // ----- contract_status_history (append-only) -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_status_history (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID NOT NULL,
      contract_id      UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      from_status      contract_status,
      to_status        contract_status NOT NULL,
      changed_by       UUID NOT NULL,
      reason           TEXT,
      changed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS status_history_tenant_contract_idx
      ON contract_status_history (tenant_school_id, contract_id);
  `);

  // ----- audit_logs (immuable) -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID NOT NULL,
      entity_type      VARCHAR(128) NOT NULL,
      entity_id        UUID NOT NULL,
      action           VARCHAR(128) NOT NULL,
      actor_user_id    UUID,
      payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip               VARCHAR(64),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_tenant_entity_idx
      ON audit_logs (tenant_school_id, entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS audit_tenant_created_idx
      ON audit_logs (tenant_school_id, created_at);
  `);
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;
  await sql.query(`
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS contract_status_history CASCADE;
    DROP TABLE IF EXISTS contract_documents CASCADE;
    DROP TABLE IF EXISTS contract_parties CASCADE;
    DROP TABLE IF EXISTS contracts CASCADE;
    DROP TABLE IF EXISTS job_positions CASCADE;
    DROP TABLE IF EXISTS contract_types CASCADE;
    DROP TYPE IF EXISTS document_type;
    DROP TYPE IF EXISTS role_in_contract;
    DROP TYPE IF EXISTS party_type;
    DROP TYPE IF EXISTS renewal_mode;
    DROP TYPE IF EXISTS contract_status;
    DROP TYPE IF EXISTS contract_scope;
  `);
}
