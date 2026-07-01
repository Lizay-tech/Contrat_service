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

```
DRAFT → PENDING_APPROVAL → APPROVED → PENDING_SIGNATURE → ACTIVE
ACTIVE → AMENDED → ACTIVE
ACTIVE → EXPIRING → (RENEWED → ACTIVE | EXPIRED)
ACTIVE → TERMINATED
DRAFT | PENDING_APPROVAL | APPROVED → CANCELLED
EXPIRED | TERMINATED → ARCHIVED
```
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
