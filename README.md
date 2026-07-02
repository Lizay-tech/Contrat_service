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

---

# Phase 2 — Modèles (templates) + Signature électronique

Extension du service : modèles de contrat versionnés, rendu de variables `{{…}}`,
génération PDF, et cycle de signature électronique (intégration `signature-service` 8093).

## 14. Modèle de données (migrations 0003 & 0004)

- `contract_templates` — `scope_owner` (PREDEFINED|SCHOOL), `contract_type_id`, `status` (DRAFT|PUBLISHED|ARCHIVED), `current_version`.
- `template_versions` — `body` (HTML restreint + `{{tokens}}`), `header`, `footer`, `variables` (**jsonb**), `is_predefined`, `published_at`.
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
- **PDF → pdfkit + mini-renderer HTML restreint** (`<h1-3>,<p>,<br>,<strong>,<em>,<ul><li>,<table>`) :
  pas de Chromium headless → image Docker légère, rendu déterministe. Puppeteer serait
  réservé à un HTML/CSS arbitraire.
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
| POST | `/contracts/from-template` | `{ templateId, variables, parties, startDate, … }` → DRAFT + `rendered_body` + PDF généré |
| GET | `/contracts/:id/pdf` | (Re)génère et renvoie le PDF |

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
