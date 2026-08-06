import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import {
  bearer,
  closeDatabase,
  prepareDatabase,
  signToken,
  truncateBusinessTables,
} from './helpers';

const API = '/api/v1';
let app: Express;

/** Recupere l'id d'un type de contrat par code via l'API referentiel. */
async function typeIdByCode(token: string, code: string): Promise<string> {
  const res = await request(app).get(`${API}/contract-types`).set('Authorization', bearer(token));
  const found = res.body.data.find((t: { code: string }) => t.code === code);
  if (!found) throw new Error(`Type ${code} introuvable`);
  return found.id;
}

beforeAll(async () => {
  await prepareDatabase();
  app = createApp();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await truncateBusinessTables();
});

describe('Contrats du personnel (scope PERSONNEL)', () => {
  const schoolA = randomUUID();
  const token = () => signToken({ schoolId: schoolA, roleCode: 'DIRECTEUR' });

  it('cree un contrat, ajoute une partie, uploade un PDF puis passe DRAFT -> ACTIVE', async () => {
    const typeId = await typeIdByCode(token(), 'PERSONNEL_CDI');

    // Creation
    const created = await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(token()))
      .send({ contractTypeId: typeId, title: 'Contrat enseignant Jean' });
    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.status).toBe('DRAFT');
    expect(created.body.data.tenantSchoolId).toBe(schoolA);
    expect(created.body.data.contractNumber).toMatch(/^CT-\d{4}-\d{6}$/);
    const id = created.body.data.id;

    // Ajout d'une partie
    const party = await request(app)
      .post(`${API}/contracts/${id}/parties`)
      .set('Authorization', bearer(token()))
      .send({
        partyType: 'PERSON',
        roleInContract: 'EMPLOYE',
        fullName: 'Jean Baptiste',
        email: 'jean@ecole.ht',
      });
    expect(party.status).toBe(201);

    // Upload d'un document + verification du sha256
    const content = Buffer.from('%PDF-1.4 contenu de test');
    const expectedHash = createHash('sha256').update(content).digest('hex');
    const doc = await request(app)
      .post(`${API}/contracts/${id}/documents`)
      .set('Authorization', bearer(token()))
      .field('type', 'ORIGINAL')
      .attach('file', content, 'contrat.pdf');
    expect(doc.status).toBe(201);
    expect(doc.body.data.sha256).toBe(expectedHash);
    expect(doc.body.data.version).toBe(1);

    // Transitions DRAFT -> ... -> ACTIVE
    for (const toStatus of ['PENDING_APPROVAL', 'APPROVED', 'PENDING_SIGNATURE', 'ACTIVE']) {
      const tr = await request(app)
        .post(`${API}/contracts/${id}/transition`)
        .set('Authorization', bearer(token()))
        .send({ toStatus });
      expect(tr.status).toBe(200);
      expect(tr.body.data.status).toBe(toStatus);
    }

    // Historique complet
    const history = await request(app)
      .get(`${API}/contracts/${id}/history`)
      .set('Authorization', bearer(token()));
    expect(history.status).toBe(200);
    // creation (null->DRAFT) + 4 transitions = 5 entrees
    expect(history.body.data.statusHistory).toHaveLength(5);
  });

  it('refuse une transition interdite (409) sans rien alterer', async () => {
    const typeId = await typeIdByCode(token(), 'PERSONNEL_CDD');
    const created = await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(token()))
      .send({ contractTypeId: typeId, title: 'CDD surveillant' });
    const id = created.body.data.id;

    const tr = await request(app)
      .post(`${API}/contracts/${id}/transition`)
      .set('Authorization', bearer(token()))
      .send({ toStatus: 'ACTIVE' });
    expect(tr.status).toBe(409);

    const detail = await request(app)
      .get(`${API}/contracts/${id}`)
      .set('Authorization', bearer(token()));
    expect(detail.body.data.status).toBe('DRAFT');
  });

  it('ignore tout schoolId passe dans le body (seul le JWT compte)', async () => {
    const typeId = await typeIdByCode(token(), 'PERSONNEL_CDI');
    const created = await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(token()))
      .send({
        contractTypeId: typeId,
        title: 'Tentative injection tenant',
        schoolId: randomUUID(),
        tenant_school_id: randomUUID(),
      });
    expect(created.status).toBe(201);
    expect(created.body.data.tenantSchoolId).toBe(schoolA);
  });

  it('rejette une requete sans JWT (401)', async () => {
    const res = await request(app).get(`${API}/contracts`);
    expect(res.status).toBe(401);
  });
});

describe('Contrats d etablissement (scope ETABLISSEMENT)', () => {
  const subjectSchool = randomUUID();
  const adminToken = () => signToken({ schoolId: randomUUID(), roleCode: 'SUPER_ADMIN' });
  const userToken = () => signToken({ schoolId: randomUUID(), roleCode: 'DIRECTEUR' });

  it('un admin EDUCA cree un abonnement pour une ecole (partie SCHOOL auto, tenant systeme)', async () => {
    const typeId = await typeIdByCode(adminToken(), 'ETAB_ABONNEMENT');
    const created = await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(adminToken()))
      .send({ contractTypeId: typeId, title: 'Abonnement SaaS 2026', subjectSchoolId: subjectSchool });

    expect(created.status).toBe(201);
    expect(created.body.data.subjectSchoolId).toBe(subjectSchool);
    expect(created.body.data.tenantSchoolId).toBe('00000000-0000-0000-0000-000000000001');
    const parties = created.body.data.parties;
    expect(parties.some((p: { partyType: string; schoolId: string }) =>
      p.partyType === 'SCHOOL' && p.schoolId === subjectSchool)).toBe(true);
  });

  it('refuse (403) a un role non autorise la creation d un contrat d etablissement', async () => {
    const typeId = await typeIdByCode(userToken(), 'ETAB_ABONNEMENT');
    const res = await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(userToken()))
      .send({ contractTypeId: typeId, title: 'Tentative', subjectSchoolId: subjectSchool });
    expect(res.status).toBe(403);
  });

  it('liste/filtre les contrats d une ecole donnee', async () => {
    const typeId = await typeIdByCode(adminToken(), 'ETAB_LICENCE');
    const t = adminToken();
    await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(t))
      .send({ contractTypeId: typeId, title: 'Licence', subjectSchoolId: subjectSchool });

    const list = await request(app)
      .get(`${API}/contracts?scope=ETABLISSEMENT&subjectSchoolId=${subjectSchool}`)
      .set('Authorization', bearer(t));
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(list.body.data.items.every((c: { subjectSchoolId: string }) =>
      c.subjectSchoolId === subjectSchool)).toBe(true);
  });
});

describe('Isolation multi-tenant (RLS)', () => {
  it('un tenant ne voit jamais les contrats d un autre', async () => {
    const schoolA = randomUUID();
    const schoolB = randomUUID();
    const tokenA = signToken({ schoolId: schoolA, roleCode: 'DIRECTEUR' });
    const tokenB = signToken({ schoolId: schoolB, roleCode: 'DIRECTEUR' });

    const typeId = await typeIdByCode(tokenA, 'PERSONNEL_CDI');
    const created = await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(tokenA))
      .send({ contractTypeId: typeId, title: 'Contrat prive A' });
    const idA = created.body.data.id;

    // B ne voit pas le contrat de A dans la liste
    const listB = await request(app).get(`${API}/contracts`).set('Authorization', bearer(tokenB));
    expect(listB.body.data.items.find((c: { id: string }) => c.id === idA)).toBeUndefined();

    // B ne peut pas acceder au detail du contrat de A
    const detailB = await request(app)
      .get(`${API}/contracts/${idA}`)
      .set('Authorization', bearer(tokenB));
    expect(detailB.status).toBe(404);

    // A voit bien son contrat
    const listA = await request(app).get(`${API}/contracts`).set('Authorization', bearer(tokenA));
    expect(listA.body.data.items.find((c: { id: string }) => c.id === idA)).toBeDefined();
  });
});
