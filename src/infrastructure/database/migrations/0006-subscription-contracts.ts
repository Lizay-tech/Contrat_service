import type { QueryInterface } from 'sequelize';

/**
 * Contrats d'abonnement etablissement (type ETAB_ABONNEMENT).
 *
 * Ce que cette migration ajoute au moteur generique existant, et pourquoi :
 *
 *  1. contract_service_lines — les services couverts par le contrat. Le moteur
 *     ne connait que des montants globaux ; un abonnement EDUCA doit enumerer
 *     ce qu'il couvre, service par service, avec son tarif et sa date
 *     d'activation. Les lignes sont DATEES PAR VERSION : une ligne appartient a
 *     la version du contrat qui l'a introduite, ce qui rend chaque version
 *     relisable telle qu'elle a ete signee.
 *
 *  2. contract_versions — l'historique consultable exige par le metier
 *     (V1 -> ajout Bibliotheque -> V2). Distinct de contract_status_history,
 *     qui trace les transitions d'etat, pas le CONTENU. Chaque version fige un
 *     instantane JSON du contrat et de ses lignes : c'est ce qui permet de
 *     relire une version signee meme apres modification du contrat courant.
 *
 *  3. Etats du double parcours de signature. L'enum existant ne distingue pas
 *     qui doit signer : PENDING_SIGNATURE ne dit pas si l'on attend EDUCA ou
 *     l'etablissement, et ne sait pas exprimer « une des deux parties a signe ».
 *     Trois valeurs sont ajoutees, sans toucher aux existantes — les contrats
 *     de travail en production continuent d'utiliser leur parcours.
 *
 * Isolation : les deux tables portent tenant_school_id et la meme policy RLS
 * que les tables metier. Une table sans policy serait lisible de tous les
 * tenants, ce qui viderait de son sens l'isolation du reste du schema.
 */

const TENANT_MATCH = `tenant_school_id = current_setting('app.tenant_school_id', true)::uuid`;

/**
 * Etats ajoutes pour le parcours a deux signataires.
 * REJECTED est distinct de CANCELLED : le refus vient d'une partie, le retrait
 * vient d'EDUCA. Un seul etat pour les deux effacerait la raison de l'echec.
 */
const NEW_STATUSES = [
  'WAITING_SIGNATURE_ADMIN',
  'WAITING_SIGNATURE_SCHOOL',
  'PARTIALLY_SIGNED',
  'REJECTED',
];

export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;

  // ----- Extension de l'enum d'etats -----
  // ADD VALUE IF NOT EXISTS est idempotent et ne reecrit pas la table.
  for (const value of NEW_STATUSES) {
    await sql.query(`ALTER TYPE contract_status ADD VALUE IF NOT EXISTS '${value}';`);
  }

  // Statut d'une ligne, repris de service-management-service pour que les deux
  // vocabulaires coincident a la lecture.
  await sql.query(`
    DO $$ BEGIN
      CREATE TYPE service_line_status AS ENUM ('ACTIVE','INACTIVE','SUSPENDED','PENDING');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // ----- contract_versions -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_versions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id UUID NOT NULL,
      contract_id      UUID NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      version          INTEGER NOT NULL,
      -- Instantane complet du contrat et de ses lignes au moment du figeage.
      -- Sans lui, relire la V1 apres passage en V3 serait impossible.
      snapshot         JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- Ce qui a motive la nouvelle version, en clair.
      change_reason    TEXT,
      created_by       UUID NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT contract_versions_unique UNIQUE (contract_id, version),
      CONSTRAINT contract_versions_positive CHECK (version >= 1)
    );
  `);

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_contract_versions_contract
      ON contract_versions (contract_id, version DESC);
  `);

  // ----- contract_service_lines -----
  await sql.query(`
    CREATE TABLE IF NOT EXISTS contract_service_lines (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_school_id  UUID NOT NULL,
      contract_id       UUID NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
      -- Version qui a introduit la ligne, et version qui l'a retiree (NULL si
      -- toujours presente). Deux colonnes plutot qu'une suppression : un
      -- service retire doit rester lisible dans les versions anterieures.
      from_version      INTEGER NOT NULL DEFAULT 1,
      to_version        INTEGER,
      -- Correspondance avec service-management-service. Aucune cle etrangere :
      -- c'est un autre service, et une FK inter-bases n'existe pas.
      school_service_id UUID,
      service_id        UUID NOT NULL,
      service_code      VARCHAR(64) NOT NULL,
      service_name      VARCHAR(255) NOT NULL,
      description       TEXT,
      status            service_line_status NOT NULL DEFAULT 'PENDING',
      -- Tarif applique a l'etablissement : surcharge negociee si elle existe,
      -- sinon tarif catalogue. La distinction est faite en amont.
      unit_price        NUMERIC(12,2),
      currency          VARCHAR(3) NOT NULL DEFAULT 'HTG',
      quantity          INTEGER NOT NULL DEFAULT 1,
      billing_type      VARCHAR(16),
      duration_days     INTEGER,
      activation_date   TIMESTAMPTZ,
      expiration_date   TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT contract_service_lines_quantity CHECK (quantity >= 1),
      CONSTRAINT contract_service_lines_price CHECK (unit_price IS NULL OR unit_price >= 0),
      CONSTRAINT contract_service_lines_versions CHECK (to_version IS NULL OR to_version >= from_version)
    );
  `);

  // Un service n'apparait qu'une fois parmi les lignes VIVANTES d'un contrat.
  // L'index partiel autorise la reapparition d'un service retire puis rajoute.
  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_service_lines_current
      ON contract_service_lines (contract_id, service_id) WHERE to_version IS NULL;
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_contract_service_lines_contract
      ON contract_service_lines (contract_id, from_version);
  `);

  // ----- Contrat : version courante -----
  await sql.query(`
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;
  `);

  // Un etablissement n'a qu'UN contrat d'abonnement vivant a la fois. Sans cette
  // contrainte, deux souscriptions concurrentes en creeraient deux, et plus rien
  // ne dirait lequel fait foi.
  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_subscription_per_school
      ON contracts (subject_school_id, contract_type_id)
      WHERE deleted_at IS NULL AND subject_school_id IS NOT NULL;
  `);

  // ----- RLS, alignee sur les tables metier existantes -----
  for (const table of ['contract_service_lines']) {
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

  // Les versions sont immuables : append-only, comme l'historique de statut.
  // Une version modifiable ne prouverait plus rien de ce qui a ete signe.
  await sql.query(`
    ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE contract_versions FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS contract_versions_tenant_select ON contract_versions;
    DROP POLICY IF EXISTS contract_versions_tenant_insert ON contract_versions;
    CREATE POLICY contract_versions_tenant_select ON contract_versions
      FOR SELECT USING (${TENANT_MATCH});
    CREATE POLICY contract_versions_tenant_insert ON contract_versions
      FOR INSERT WITH CHECK (${TENANT_MATCH});
  `);
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  const sql = qi.sequelize;

  await sql.query(`DROP INDEX IF EXISTS idx_contracts_subscription_per_school;`);
  await sql.query(`ALTER TABLE contracts DROP COLUMN IF EXISTS current_version;`);
  await sql.query(`DROP TABLE IF EXISTS contract_service_lines CASCADE;`);
  await sql.query(`DROP TABLE IF EXISTS contract_versions CASCADE;`);
  await sql.query(`DROP TYPE IF EXISTS service_line_status;`);

  // Les valeurs ajoutees a contract_status ne sont PAS retirees : PostgreSQL ne
  // sait pas supprimer une valeur d'enum, et une reecriture du type casserait
  // les contrats qui l'utilisent. Le down reste donc volontairement partiel,
  // ce qui est sans consequence : une valeur inutilisee ne gene personne.
}
