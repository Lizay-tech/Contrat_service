<<<<<<< HEAD
# contrat-service (EDUCA.TECH)

Contract Management Service (CLM) de la plateforme microservices **EDUCA.TECH**.
Il gère le cycle de vie des contrats **du personnel** des établissements et des
contrats **d'établissement** (EDUCA/Lizay ↔ école).

> **Phase 1 – Socle.** Types de contrats, création, machine à états, parties,
> documents (upload + sha256), audit immuable, listing paginé, isolation
> multi-tenant **PostgreSQL RLS**, publication d'événements **RabbitMQ**.
> Les modules avancés (signature multiple, workflows, clauses, litiges…) sont
> _réservés_ (tables créées, logique en Phase ≥ 2).

- **Port :** `8091` · **Domaine :** `contrat.educasoft.tech`
- **Base dédiée :** `educa_contrat_service`

---

## 1. Architecture (Clean Architecture)

```
src/
  domain/          Entités & règles pures (Contract, machine à états, enums)
  application/     Use-cases + ports (interfaces repositories/services)
  infrastructure/  Sequelize, repositories, Redis, RabbitMQ, PDF, stockage, UoW
  interfaces/      Controllers Express, routes, middlewares, validation (zod)
  shared/          Config env, logger (pino), erreurs, enveloppe HTTP
  migrations/      Migrations SQL (umzug) — RLS incluse
  seeders/         Référentiels (contract_types, catalogue des postes)
```

Règles :
- Le **domaine** ne dépend d'aucune techno (aucun import Sequelize dans `domain/`).
- Les **repositories** sont des interfaces dans `application/ports`, implémentées dans `infrastructure/`.
- La **machine à états** (`domain/contract/ContractStateMachine.ts`) est la **seule** autorité sur les transitions.

### Décisions de conception

| Sujet | Choix | Justification |
|---|---|---|
| **PDF** | `pdfkit` | Documents structurés simples ; pas de Chromium headless à embarquer, image Docker légère. Interface `IPdfGenerator` → un générateur `puppeteer` pourra la remplacer en Phase 2 (templates HTML). |
| **Stockage** | disque local (`IFileStorage`) | Volume Docker en Phase 1 ; adapter S3 sans toucher aux use-cases. |
| **RLS** | `SET LOCAL app.tenant_school_id` par transaction (UoW) | Sûr avec un pool de connexions (contrairement à un `SET` de session). `FORCE ROW LEVEL SECURITY` + rôle **non-superuser** ⇒ RLS réellement appliquée. |
| **`tenant_school_id` vs `subject_school_id`** | deux notions distinctes | `tenant_school_id` = clé RLS (à qui appartient l'enregistrement, **toujours issu du JWT**). `subject_school_id` = école objet d'un contrat d'établissement. |
| **contract_types** | référentiel **global** (sans RLS) | Catalogue partagé, seedé une fois. |

> **Contrats d'établissement (`scope = ETABLISSEMENT`)** : `tenant_school_id` est
> forcé au **tenant système EDUCA** (`EDUCA_SYSTEM_TENANT_ID`). Les comptes
> administrateurs EDUCA doivent donc être émis avec `schoolId = tenant système`
> pour retrouver/lister ces contrats via RLS. Seuls les rôles de
> `EDUCA_ADMIN_ROLES` peuvent les créer.

---

## 2. Prérequis

- Node.js ≥ 20
- Docker + Docker Compose (dev local : PostgreSQL, Redis, RabbitMQ)

---

## 3. Démarrage rapide (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Le compose :
1. démarre **PostgreSQL** (crée le rôle non-superuser `educa` + la base `educa_contrat_service`),
   **Redis**, **RabbitMQ** ;
2. lance le service `migrate` (migrations + seed) ;
3. démarre `contrat-service` sur **:8091** (et Nginx sur :8080).

Vérifier la santé :

```bash
curl http://localhost:8091/health
```

---

## 4. Démarrage local (sans conteneur applicatif)

```bash
npm install
cp .env.example .env            # ajuster DB/Redis/RabbitMQ si besoin

# Démarrer uniquement les dépendances
docker compose up -d postgres redis rabbitmq

# Migrations + seed
npm run migrate
npm run seed
# (ou en une commande)
npm run db:setup

# Lancer en dev (rechargement à chaud)
npm run dev
```

Build & run production :

```bash
npm run build
npm run migrate:prod && npm run seed:prod
npm start
```

---

## 5. Migrations & seed

| Commande | Effet |
|---|---|
| `npm run migrate` | Applique les migrations (ts-node). |
| `npm run migrate:undo` | Annule la dernière migration. |
| `npm run migrate:prod` | Migrations depuis `dist/` (image Docker). |
| `npm run seed` / `seed:prod` | Seed idempotent des `contract_types`. |

> `sync({ alter: true })` est **interdit** au runtime : seules les migrations
> explicites modifient le schéma. Le service fait `sequelize.authenticate()` au démarrage.

---

## 6. Tests

Les tests unitaires (machine à états) ne requièrent **aucune** dépendance.
Les tests d'intégration requièrent **PostgreSQL** (avec le rôle non-superuser `educa`
pour que RLS soit réellement testée) :

```bash
docker compose up -d postgres
npm test
```

Couverture :
- **Unitaire** : machine à états (chemins valides + refus).
- **Intégration** : création PERSONNEL & ETABLISSEMENT, transitions (dont refus **409**),
  upload document + **sha256**, pagination/filtre, **isolation RLS** (un tenant ne
  voit jamais les contrats d'un autre), séquence de numéro par tenant.

Typecheck (src + tests) : `npx tsc -p tsconfig.test.json`.

---

## 7. Conventions EDUCA appliquées

- **JWT** (secret partagé `educa_access_secret_2026`), claims camelCase `schoolId`, `userId`, `roleCode`, validé sur chaque route protégée.
- `school_id` **exclusivement** issu du JWT — tout `schoolId` du body/query est **ignoré**.
- Enveloppe **systématique** : `{ success, data?, error? }`.
- Pagination : `{ success, data: { items, total, page, limit } }`.
- Index PostgreSQL **nommés explicitement** (< 63 caractères).
- Codes HTTP : `201` création, `400` validation, `401` auth, `403` RBAC, `404`, `409` conflit/transition, `422` règle métier.

---

## 8. API (base `/api/v1`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Santé (DB, Redis, RabbitMQ). |
| GET | `/api/v1/contract-types` | Référentiel des types. |
| POST | `/api/v1/contracts` | Créer (DRAFT ; gère PERSONNEL & ETABLISSEMENT). |
| GET | `/api/v1/contracts` | Liste paginée + filtres (`status`, `contractTypeId`, `scope`, `subjectSchoolId`, dates, `search`). |
| GET | `/api/v1/contracts/:id` | Détail (parties + documents + dernier statut). |
| PATCH | `/api/v1/contracts/:id` | Mise à jour (DRAFT uniquement). |
| POST | `/api/v1/contracts/:id/transition` | Appliquer une transition d'état. |
| POST | `/api/v1/contracts/:id/parties` | Ajouter une partie. |
| DELETE | `/api/v1/contracts/:id/parties/:partyId` | Retirer une partie. |
| POST | `/api/v1/contracts/:id/documents` | Upload multipart (`document`), sha256 + version. |
| GET | `/api/v1/contracts/:id/documents/:docId` | Téléchargement authentifié. |
| GET | `/api/v1/contracts/:id/history` | Historique statuts + audit. |

### Machine à états
=======
# contrat-service — EDUCA.TECH (Contract Lifecycle Management)

Microservice de gestion du cycle de vie des contrats de la plateforme EDUCA.TECH.
Gère deux familles de contrats :

- **Personnel** (`scope = PERSONNEL`) : entre un établissement et un membre de son personnel.
- **Établissement** (`scope = ETABLISSEMENT`) : entre EDUCA / Lizay et une école (abonnement SaaS, licence, maintenance, partenariat, CGU, DPA…).

> Phase 1 – Socle : types de contrats, création, machine à états, parties, documents PDF (upload + hash),
> audit immuable, recherche paginée, isolation multi-tenant (RLS) et publication d'événements RabbitMQ.

- **Port** : `8091` · **Domaine** : `contrat.educasoft.tech` · **Base** : `educa_contrat_service`

---

## 1. Stack

Node.js + TypeScript (strict), Express, Sequelize (PostgreSQL), Redis (ioredis), RabbitMQ (amqplib),
pino (logs structurés), zod (validation), **Puppeteer** (génération PDF HTML+CSS), umzug (migrations), Jest + Supertest.

## 2. Architecture (Clean Architecture)

```
src/
  domain/          # Règles métier pures (machine à états) — aucune dépendance techno
  infrastructure/  # Sequelize (models, migrations, seeders), Redis, RabbitMQ, PDF, storage, clients HTTP
  interfaces/      # Middlewares Express (auth JWT, tenant/RLS, RBAC, erreurs), agrégateur de routes
  modules/         # contract, contract-type, document, audit, health (repo/service/controller/routes)
  shared/          # config (env, logger), erreurs, enveloppe de réponse, types/enums
```

- Le **domaine** ne dépend d'aucune techno (`domain/contract/status-machine.ts` est la seule autorité sur les transitions).
- Les **repositories** encapsulent Sequelize ; les **services** portent les cas d'usage.
- Modules **Phase ≥ 2** prévus (non implémentés) : signature multiple, workflows, clauses, templates,
  renouvellements, avenants, résiliations, litiges, IA — les tables sont anticipées, l'archi les rend faciles à brancher.

## 3. Conventions EDUCA appliquées

- **JWT** (secret partagé `educa_access_secret_2026`), claims camelCase `schoolId`, `userId`, `roleCode`, validé sur chaque route protégée.
- `school_id` provient **exclusivement du JWT** — tout `schoolId` dans le body/query est ignoré.
- Enveloppe systématique `{ success, data?, error? }` ; pagination `{ items, total, page, limit }`.
- Index PostgreSQL nommés explicitement (< 63 caractères).
- **Aucun `sync({ alter })`** au runtime : `sequelize.authenticate()` + migrations umzug.
- Isolation par année scolaire via `annee_scolaire_id` (cache Redis / annee-scolaire-service).
- Codes HTTP : `201` création, `400` validation, `401` auth, `403` RBAC, `404`, `409` conflit (transition interdite), `422` métier.

## 4. Multi-tenant & RLS

- `tenant_school_id` = clé RLS (propriétaire de l'enregistrement), **toujours issu du JWT**.
- `subject_school_id` = école objet du contrat (contrats d'établissement uniquement).
- Contrats d'établissement → `tenant_school_id = EDUCA_SYSTEM_TENANT_ID` (tenant système, configurable).
- Chaque requête s'exécute dans une transaction où `SET LOCAL app.tenant_school_id` est positionné ;
  les policies `ROW LEVEL SECURITY` (`FORCE`) filtrent toutes les tables métier. `audit_logs` et
  `contract_status_history` sont **append-only** (aucune policy UPDATE/DELETE → immuables).

## 5. Machine à états
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3

```
DRAFT → PENDING_APPROVAL → APPROVED → PENDING_SIGNATURE → ACTIVE
ACTIVE → AMENDED → ACTIVE
ACTIVE → EXPIRING → (RENEWED → ACTIVE | EXPIRED)
ACTIVE → TERMINATED
DRAFT | PENDING_APPROVAL | APPROVED → CANCELLED
EXPIRED | TERMINATED → ARCHIVED
```
<<<<<<< HEAD
Une transition non autorisée renvoie **409** et n'altère rien.

### Événements RabbitMQ (exchange topic `educa.contracts`)

`contract.created`, `contract.status_changed`, `contract.signed`,
`contract.expiring`, `contract.terminated`.

---

## 9. Exemples de requêtes

Voir [`requests.http`](./requests.http) (compatible VS Code REST Client / IntelliJ HTTP).
Générer un JWT de test :

```bash
node -e "console.log(require('jsonwebtoken').sign({userId:'11111111-1111-1111-1111-111111111111',schoolId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',roleCode:'DIRECTEUR'},'educa_access_secret_2026',{expiresIn:'2h'}))"
```

---

## 10. Intégrations inter-services

| Service | Port | Usage Phase 1 |
|---|---|---|
| manage-account | 8081 | Émet les JWT (vérifiés par secret partagé). |
| annee-scolaire-service | 8082 | Année active (cache Redis) → `annee_scolaire_id`. |
| communication-core-service | 8087 | Intention de notification via RabbitMQ (pas d'appel direct). |
| signature-service | 8093 | Interface `ISignatureClient` **définie**, non implémentée (Phase 2). |

---

## 11. Tables (Phase 1)

`contract_types` (global), `contracts`, `contract_parties`, `contract_documents`,
`contract_status_history`, `audit_logs` (immuable, trigger anti UPDATE/DELETE),
`contract_sequences` (numérotation par tenant). Toutes les tables métier portent
`tenant_school_id` + RLS `FORCE`. Les tables Phase ≥ 2 sont réservées
(`0002-phase2-reserved`).
=======

Toute transition est validée par le domaine, journalisée (`contract_status_history` + `audit_logs`)
et publie un événement RabbitMQ. Une transition interdite renvoie **409** sans rien altérer.

## 6. API REST (base `/api/v1`)

| Méthode | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Santé (DB, Redis, RabbitMQ) — publique |
| GET | `/contract-types` | Référentiel des types |
| POST | `/contracts` | Créer (DRAFT ; gère les 2 scopes) |
| GET | `/contracts` | Liste paginée + filtres (`status`, `contractTypeId`, `scope`, `subjectSchoolId`, `dateFrom`, `dateTo`, `search`, `page`, `limit`) |
| GET | `/contracts/:id` | Détail (parties + documents + historique) |
| PATCH | `/contracts/:id` | Mise à jour (uniquement en DRAFT) |
| POST | `/contracts/:id/transition` | `{ toStatus, reason? }` — machine à états |
| POST | `/contracts/:id/parties` | Ajouter une partie |
| DELETE | `/contracts/:id/parties/:partyId` | Retirer une partie |
| POST | `/contracts/:id/documents` | Upload multipart (`file`) — calcule sha256, incrémente la version |
| GET | `/contracts/:id/documents` | Lister les documents |
| GET | `/contracts/:id/documents/:docId` | Télécharger (authentifié) |
| GET | `/contracts/:id/history` | Historique des statuts + audit |

## 7. Événements RabbitMQ

Exchange topic **`educa.contracts`** :
`contract.created`, `contract.status_changed`, `contract.signed`, `contract.expiring`, `contract.terminated`.

---

## 8. Démarrage local (sans Docker)

```bash
cp .env.example .env          # adapter DB / Redis / RabbitMQ si besoin
npm install
npm run migrate               # applique le schéma + RLS
npm run seed                  # référentiels : contract_types + catalogue des postes
npm run dev                   # démarre sur http://localhost:8091
```

Vérifier : `curl http://localhost:8091/api/v1/health`

## 9. Démarrage avec Docker (dev complet)

```bash
docker compose up --build
```

Démarre PostgreSQL, Redis, RabbitMQ et le service. Le conteneur applique automatiquement
les migrations + seeders puis écoute sur `:8091`.

```bash
curl http://localhost:8091/api/v1/health
```

## 10. Tests

```bash
npm test
```

- **Unitaire** (`status-machine.test.ts`) : transitions valides / refusées — sans base.
- **Intégration** (`contract.integration.test.ts`) : nécessite PostgreSQL (les tests appliquent
  migrations + seeders puis tronquent les tables entre chaque cas). Couvre :
  création PERSONNEL + parties + upload PDF + hash + DRAFT→ACTIVE, transition interdite (409),
  `schoolId` du body ignoré, création ETABLISSEMENT par admin EDUCA (403 sinon), filtrage par école,
  isolation multi-tenant (RLS).

> Pour l'intégration, exposer une base de test. Exemple rapide avec les conteneurs de compose :
> ```bash
> docker compose up -d postgres
> DB_HOST=localhost DB_PORT=5433 npm test
> ```

## 11. Scripts npm

| Script | Rôle |
|--------|------|
| `npm run dev` | Démarrage watch (ts-node-dev) |
| `npm run build` | Compilation TypeScript → `dist/` |
| `npm start` | Démarrage production (`dist/server.js`) |
| `npm run migrate` / `migrate:undo` | Migrations (dev, ts-node) |
| `npm run seed` / `seed:undo` | Seeders (dev, ts-node) |
| `npm run migrate:prod` / `seed:prod` | Migrations/seeders sur build compilé (Docker) |
| `npm test` | Jest + Supertest |
| `npm run typecheck` | `tsc --noEmit` |

## 12. Variables d'environnement

Voir [`.env.example`](.env.example) — DB, Redis, RabbitMQ, `JWT_SECRET`, `EDUCA_SYSTEM_TENANT_ID`,
`EDUCA_ADMIN_ROLES`, stockage, URLs des services (annee-scolaire, signature, communication).

## 13. Exemples de requêtes

Voir [`requests.http`](requests.http) (extension REST Client / IntelliJ HTTP).

---

# Phase 2 — Modèles (templates) + Signature électronique

Extension du service : modèles de contrat versionnés, rendu de variables `{{…}}`,
génération PDF, et cycle de signature électronique (intégration `signature-service` 8093).

## 14. Modèle de données (migrations 0003 & 0004)

- `contract_templates` — `scope_owner` (PREDEFINED|SCHOOL), `contract_type_id`, `status` (DRAFT|PUBLISHED|ARCHIVED), `current_version`.
- `template_versions` — `body` (HTML + `{{tokens}}`, rendu par Chromium), `header`, `footer`, `variables` (**jsonb**), `is_predefined`, `published_at`.
- `clauses` / `template_clauses` — bibliothèque de clauses réutilisables (rendu par concaténation ordonnée).
- `signature_requests` / `signatories` — suivi local des demandes et signataires.
- `contracts` étendue : `template_id`, `template_version`, `rendered_body`.

**RLS** : isolation stricte par tenant sur toutes ces tables. Les modèles **PREDEFINED**
(propriété du tenant système) restent **lisibles par tous** via une policy spéciale
(`scope_owner = 'PREDEFINED'` / `is_predefined = true`), mais **non modifiables** par les écoles.

> ⚠️ La RLS n'est active que si l'utilisateur PostgreSQL applicatif **n'est pas superuser**
> (les superusers contournent la RLS, même `FORCE`). En production, créez un rôle dédié
> `NOSUPERUSER` propriétaire des tables.

## 15. Décisions de conception

- **Variables → jsonb sur `template_versions`** (pas de table dédiée) : les variables sont
  intrinsèques à une version et évoluent avec son corps. Un **catalogue statique**
  ([variable-catalogue.ts](src/domain/template/variable-catalogue.ts), cf. spec A.2) fournit labels/types/`required`.
- **PDF → Puppeteer (Chromium headless)** : le corps rendu (le même HTML que `preview format:"html"`)
  est enveloppé dans un document complet avec le CSS des contrats (`html-pdf.ts`) puis converti en
  PDF fidèle (`page.pdf` A4, `printBackground`, marges). Navigateur **singleton** réutilisé.
  Variables absentes → marqueur `[à compléter]` (`.var-missing`), jamais un trou.
  En Docker : Chromium système (`apk add chromium`, `PUPPETEER_EXECUTABLE_PATH`).
- **Rendu** : moteur pur ([render.ts](src/domain/template/render.ts)) + assemblage de contexte
  ([context.ts](src/domain/template/context.ts)) : dates en français, `salary_in_words`
  (montant en toutes lettres FR, [number-to-words.ts](src/domain/template/number-to-words.ts)),
  variables système auto-remplies (`today`, `signature_zone`…).
- **Signature** : contrat-service **orchestre localement** le cycle multi-signataires
  (demandes, ordre séquentiel/parallèle, bascule → ACTIVE). Le **signature-service** (8093)
  gère, lui, les **signatures réutilisables** (paraphes TEXT/DRAWN) et un journal d'utilisations.
  Le client ([signature.client.ts](src/infrastructure/clients/signature.client.ts)) consomme
  l'API réelle du service en **transmettant le JWT de l'appelant** (routes `authenticate` + `schoolScope`) :
  `GET /api/signatures/:id`, `GET /api/signatures/:id/image`, `POST /api/signature-usages`.

## 16. Endpoints Phase 2 (base `/api/v1`)

**Templates** (écriture réservée à `TEMPLATE_MANAGER_ROLES`) :

| Méthode | Route | Description |
|--------|-------|-------------|
| GET | `/templates` | Liste (filtres `scopeOwner`, `contractTypeId`, `status`, `search`) — PREDEFINED + école |
| GET | `/templates/:id` · `/versions` · `/variables` | Détail, versions, variables détectées |
| POST | `/templates` | Créer un modèle SCHOOL (v1 brouillon) |
| PATCH | `/templates/:id` | MàJ métadonnées ; un `body` fourni crée une **nouvelle version** |
| POST | `/templates/:id/duplicate` | Cloner un modèle (PREDEFINED ou école) → modèle SCHOOL éditable |
| POST | `/templates/:id/publish` · `/archive` | Publier (fige la version) / archiver |
| POST | `/templates/:id/preview` | `{ sampleData?, format: html\|pdf }` — rendu d'exemple |
| DELETE | `/templates/:id` | Soft-delete (interdit si des contrats l'utilisent → 409) |

**Contrat depuis template** :

| Méthode | Route | Description |
|--------|-------|-------------|
| POST | `/contracts/from-template` | `{ templateId, variables, parties, startDate, renderedBody?, … }` → DRAFT + `rendered_body` + PDF généré |
| GET | `/contracts/:id/pdf` | (Re)génère et renvoie le PDF (reflète `rendered_body`) |
| PATCH | `/contracts/:id` (DRAFT) | Champs éditables **+ `renderedBody`** (ré-édition du contenu) |

**Contenu éditable (`renderedBody`)** : si `from-template` reçoit `renderedBody`, il est utilisé
**tel quel** (pas de re-rendu du modèle) ; sinon le modèle est rendu normalement. Un contrat en
**DRAFT** peut voir son `rendered_body` ré-édité via `PATCH`, puis son PDF régénéré (`GET …/pdf`).
Tout HTML fourni/édité est **assaini** ([sanitize.ts](src/infrastructure/html/sanitize.ts) — retire
`<script>`, `on*`, `<iframe>`…) avant stockage et rendu Puppeteer. L'édition du contenu est
**réservée** aux `TEMPLATE_MANAGER_ROLES` (sinon **403**). Persistance inchangée (variables jsonb,
parties, année, agrégation).

**Signature électronique** (via signature-service 8093, signature par défaut + confirmation) :

| Méthode | Route | Description |
|--------|-------|-------------|
| POST | `/contracts/:id/signature-requests` | `{ signatories[], mode: SEQUENTIAL\|PARALLEL, deadline? }` → passe APPROVED→PENDING_SIGNATURE |
| GET | `/contracts/:id/available-signatures` | Signatures de l'utilisateur courant (via 8093) avec le flag `isDefault` |
| GET | `/contracts/:id/signatures` | Statut par signataire |
| POST | `/signature-requests/:requestId/sign` | `{ signatoryId, confirmed: true, signatureId? }` |
| POST | `/signature-requests/:requestId/remind` | `{ signatoryId }` — relance (intention de notification) |

**Flux de signature** (`POST …/sign`) :
1. **Confirmation obligatoire** : `confirmed !== true` → **422**.
2. Résolution de la signature : `signatureId` fourni, sinon **signature par défaut** de l'utilisateur
   (`getDefaultSignature`). Aucune signature par défaut → **409** (invitation à en définir une).
3. Anti-usurpation : la signature (et le signataire s'il a un compte) doit appartenir à l'utilisateur courant.
4. **Apposition PDF** : récupération de l'image (DRAWN) ou du texte (TEXT), **régénération du PDF**
   avec une section « Signatures » (toutes les signatures recueillies), stocké en **document `SIGNE`**
   (sha256, version incrémentée). Le rendu de chaque signature est persisté (`signatories.signature_render`)
   pour régénérer sans re-solliciter chaque signataire.
5. Persistance du signataire (`SIGNED`, `signature_ref`, `ip`, `device`, `signed_at`) **+**
   `POST /api/signature-usages` côté 8093 (`{ document_type:'CONTRACT', document_id, used_by, signed_at }`).
6. Le tout dans la transaction du `tenantHandler` : si l'apposition/persistance échoue, **rien n'est signé**.
7. Tous signés → transition auto **→ ACTIVE**, `contract.signed`, audit.

**Client 8093** ([signature.client.ts](src/infrastructure/clients/signature.client.ts)) : propage le
**JWT de l'appelant** + l'en-tête **`X-Academic-Year-Id`** (année scolaire du contrat) ;
méthodes `listUserSignatures`, `getDefaultSignature`, `getSignature`, `getSignatureImage`, `recordUsage`.
Service injoignable → **502** explicite (pas de crash silencieux).

**Réseau Docker** : contrat-service et signature-service (`educa-dev-signature`) doivent partager le
réseau externe **`educa-net`**. Prérequis une seule fois :
```bash
docker network create educa-net
```
`SIGNATURE_SERVICE_URL=http://educa-dev-signature:8093` (déjà réglé dans docker-compose).
Vérifier depuis le conteneur : `docker exec contrat_service wget -qO- http://educa-dev-signature:8093/api/signatures`.

## 17. Modèles prédéfinis seedés (scope PREDEFINED, clonables)

Enseignant CDI · Enseignant CDD · Vacataire (horaire) · Personnel administratif ·
Prestation de service · Convention de stage · Abonnement SaaS école.
(Seeder [`0003-predefined-templates.ts`](src/infrastructure/database/seeders/0003-predefined-templates.ts).)

## 18. Rôles (RBAC)

- `EDUCA_ADMIN_ROLES` (déf. `SUPER_ADMIN,EDUCA_ADMIN`) : contrats d'établissement, gestion des modèles PREDEFINED.
- `TEMPLATE_MANAGER_ROLES` (déf. `SCHOOL_ADMIN,RESP_RH,EDUCA_ADMIN,SUPER_ADMIN`) : création/édition/publication de modèles.

## 19b. Agrégation / auto-remplissage (module `aggregation`)

Assemble un **ContractContext** depuis les microservices réels et **pré-remplit** les variables
du template (corrige les variables vides du PDF). **Résilient** : une source absente ne bloque pas
la création (contexte partiel + `missingSources`) ; les **valeurs saisies priment** sur l'agrégé.

**Sources & routes réelles découvertes** (clients dans `src/infrastructure/clients/`) :

| Source | Route réelle | Enveloppe | Champs utilisés |
|---|---|---|---|
| ecole-service | `GET /api/schools/by-id/:id` | `{ ok, data }` | `identity.nom`, `identity.logo_url`, `contact.adresse_ligne1/ville/departement/pays/telephone/email_officiel`, `meta.code_ecole`, `access[].contactResponsableNom` (proxy directeur) |
| enseignant-service | `GET /api/teachers/:id` | `{ success, data }` | `nom, prenom, poste, departement, ecole_id, matricule, date_naissance, nationalite, adresse, telephone_principal, email_professionnel, document_identite.*, superviseur_academique_id` |
| affectations-academiques | `GET /api/affectations/enseignants/:id` (ou `?enseignant_id=`) | `{ success, data }` | `dateDebut`, `isActive`, `ecoleId` (poste/dépt/manager viennent du personnel) |
| manage-account | `GET /api/users/:id` | `{ success, data }` | `first_name, last_name, email, phone` (repli si personnel absent) |
| years-service | `GET /academic-years/active` | `{ success, data }` | `id`, `name` (= « 2025-2026 ») |
| signature-service | (cf. §16) | | signatures par défaut |
| **rh / configuration / document** | **inexistants** → **fallback local** (valeurs saisies / `directorFunction='Directeur'`, `currency='HTG'`) | | |

**Endpoints** :
- `GET /contracts/aggregate/preview?employeeId=&templateId=&assignmentId=&schoolId=` → `ContractContext`
  assemblé + `variables` résolues + `template.missingRequired` + `missingSources` (pour pré-remplir le formulaire).
- `POST /contracts/from-template` accepte `employeeId`/`assignmentId` : agrège, **fusionne** `agrégé < saisi`,
  rend le corps, persiste `variables` (jsonb complet) + `rendered_body` + PDF. Requises manquantes → **422**.

**Auth inter-service** : le client propage le **JWT de l'appelant** + `X-Academic-Year-Id` (année active) ;
cache Redis court (`AGGREGATION_CACHE_TTL`) sur les données stables (école, année) ; timeout + dégradation → `null`.

**Réseau** : tous les services sur `educa-net` ; `*_SERVICE_URL` = noms de conteneurs
(`educa-dev-ecole`, `educa-dev-enseignant`, `educa-dev-affectation:3006`, `educa-dev-annee:8082`,
`educa-dev-account:8081`, `educa-dev-signature:8093`) — à adapter aux vrais noms. Vérifier avec `wget`.

**Modèles par poste** (seeder [`0004-position-templates.ts`](src/infrastructure/database/seeders/0004-position-templates.ts)) :
5 modèles PREDEFINED clonables — Administrateur administratif, Responsable pédagogique, Bibliothécaire,
Responsable disciplinaire, Enseignant — chacun avec mission, responsabilités et articles (structure §7).

## 19. Tests Phase 2

`tests/render.test.ts` (unitaire : substitution, variables requises, dates FR, nombre en lettres)
et `tests/templates-signature.integration.test.ts` (modèles prédéfinis, clonage, isolation RLS
inter-tenants, preview, contrat depuis template + PDF, variable requise manquante, **cycle de
signature → ACTIVE**). Suite complète : **38 tests**.
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
