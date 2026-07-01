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
pino (logs structurés), zod (validation), pdfkit (génération PDF), umzug (migrations), Jest + Supertest.

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

```
DRAFT → PENDING_APPROVAL → APPROVED → PENDING_SIGNATURE → ACTIVE
ACTIVE → AMENDED → ACTIVE
ACTIVE → EXPIRING → (RENEWED → ACTIVE | EXPIRED)
ACTIVE → TERMINATED
DRAFT | PENDING_APPROVAL | APPROVED → CANCELLED
EXPIRED | TERMINATED → ARCHIVED
```

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
