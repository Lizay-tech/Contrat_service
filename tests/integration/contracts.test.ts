import { createHash } from 'crypto';
import request from 'supertest';
import { Express } from 'express';
import { buildTestApp, publishedEvents } from '../helpers/app';
import { bearer } from '../helpers/jwt';
import { contractTypeIdByCode, prepareDatabase, truncateAll } from '../helpers/db';

const SCHOOL_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A = 'a0000000-0000-0000-0000-000000000001';
const authA = { userId: USER_A, schoolId: SCHOOL_A, roleCode: 'DIRECTEUR' };

let app: Express;

beforeAll(async () => {
  await prepareDatabase();
  app = buildTestApp().app;
});

beforeEach(async () => {
  await truncateAll();
  publishedEvents.length = 0;
});

describe('Contract lifecycle (PERSONNEL)', () => {
  it('creates a PERSONNEL contract in DRAFT, adds a party, uploads a PDF and reaches ACTIVE', async () => {
    const contractTypeId = await contractTypeIdByCode('CDI');

    // --- create ---
    const createRes = await request(app)
      .post('/api/v1/contracts')
      .set('Authorization', bearer(authA))
      .send({ contractTypeId, title: 'Contrat enseignant', schoolId: 'HACK-IGNORED' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const contract = createRes.body.data;
    expect(contract.status).toBe('DRAFT');
    expect(contract.scope).toBe('PERSONNEL');
    // schoolId from body must be ignored; tenant is the JWT school.
    expect(contract.tenantSchoolId).toBe(SCHOOL_A);
    expect(contract.contractNumber).toMatch(/^EDUCA-PER-\d{4}-\d{5}$/);
    expect(publishedEvents.map((e) => e.routingKey)).toContain('contract.created');

    const id = contract.id;

    // --- add party ---
    const partyRes = await request(app)
      .post(`/api/v1/contracts/${id}/parties`)
      .set('Authorization', bearer(authA))
      .send({
        partyType: 'PERSON',
        roleInContract: 'EMPLOYE',
        fullName: 'Jean Baptiste',
        email: 'jean@example.com',
      });
    expect(partyRes.status).toBe(201);

    // --- upload document + hash ---
    const pdf = Buffer.from('%PDF-1.4 fake contract body');
    const expectedHash = createHash('sha256').update(pdf).digest('hex');
    const docRes = await request(app)
      .post(`/api/v1/contracts/${id}/documents`)
      .set('Authorization', bearer(authA))
      .field('type', 'ORIGINAL')
      .attach('document', pdf, { filename: 'contrat.pdf', contentType: 'application/pdf' });

    expect(docRes.status).toBe(201);
    expect(docRes.body.data.sha256Hash).toBe(expectedHash);
    expect(docRes.body.data.version).toBe(1);

    // --- walk to ACTIVE ---
    for (const toStatus of [
      'PENDING_APPROVAL',
      'APPROVED',
      'PENDING_SIGNATURE',
      'ACTIVE',
    ]) {
      const t = await request(app)
        .post(`/api/v1/contracts/${id}/transition`)
        .set('Authorization', bearer(authA))
        .send({ toStatus });
      expect(t.status).toBe(200);
      expect(t.body.data.status).toBe(toStatus);
    }

    // --- history is complete ---
    const hist = await request(app)
      .get(`/api/v1/contracts/${id}/history`)
      .set('Authorization', bearer(authA));
    expect(hist.status).toBe(200);
    const toStatuses = hist.body.data.statusHistory.map(
      (h: { toStatus: string }) => h.toStatus,
    );
    expect(toStatuses).toEqual([
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'PENDING_SIGNATURE',
      'ACTIVE',
    ]);
    expect(hist.body.data.audit.length).toBeGreaterThan(0);
  });

  it('rejects an illegal transition with 409 and leaves the contract unchanged', async () => {
    const contractTypeId = await contractTypeIdByCode('CDD');
    const createRes = await request(app)
      .post('/api/v1/contracts')
      .set('Authorization', bearer(authA))
      .send({ contractTypeId, title: 'Contrat court' });
    const id = createRes.body.data.id;

    const bad = await request(app)
      .post(`/api/v1/contracts/${id}/transition`)
      .set('Authorization', bearer(authA))
      .send({ toStatus: 'ACTIVE' }); // DRAFT -> ACTIVE is illegal
    expect(bad.status).toBe(409);
    expect(bad.body.success).toBe(false);
    expect(bad.body.error.code).toBe('ILLEGAL_TRANSITION');

    const detail = await request(app)
      .get(`/api/v1/contracts/${id}`)
      .set('Authorization', bearer(authA));
    expect(detail.body.data.contract.status).toBe('DRAFT');
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/contracts');
    expect(res.status).toBe(401);
  });

  it('paginates and filters the contract list', async () => {
    const cdi = await contractTypeIdByCode('CDI');
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', bearer(authA))
        .send({ contractTypeId: cdi, title: `Contrat ${i}` });
    }

    const page1 = await request(app)
      .get('/api/v1/contracts?page=1&limit=2&status=DRAFT')
      .set('Authorization', bearer(authA));
    expect(page1.status).toBe(200);
    expect(page1.body.data.total).toBe(3);
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.page).toBe(1);
    expect(page1.body.data.limit).toBe(2);
  });
});

describe('Contract creation (ETABLISSEMENT)', () => {
  const educaAdmin = {
    userId: 'e0000000-0000-0000-0000-000000000001',
    schoolId: '00000000-0000-0000-0000-0000000ed0ca', // system tenant
    roleCode: 'EDUCA_ADMIN',
  };
  const targetSchool = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('lets an EDUCA admin create an ETABLISSEMENT contract with an auto SCHOOL party', async () => {
    const abo = await contractTypeIdByCode('ABONNEMENT');
    const res = await request(app)
      .post('/api/v1/contracts')
      .set('Authorization', bearer(educaAdmin))
      .send({ contractTypeId: abo, title: 'Abonnement SaaS', subjectSchoolId: targetSchool });

    expect(res.status).toBe(201);
    expect(res.body.data.scope).toBe('ETABLISSEMENT');
    expect(res.body.data.subjectSchoolId).toBe(targetSchool);
    expect(res.body.data.tenantSchoolId).toBe('00000000-0000-0000-0000-0000000ed0ca');

    const detail = await request(app)
      .get(`/api/v1/contracts/${res.body.data.id}`)
      .set('Authorization', bearer(educaAdmin));
    const schoolParty = detail.body.data.parties.find(
      (p: { partyType: string }) => p.partyType === 'SCHOOL',
    );
    expect(schoolParty).toBeDefined();
    expect(schoolParty.schoolId).toBe(targetSchool);
  });

  it('forbids a non-EDUCA role from creating an ETABLISSEMENT contract (403)', async () => {
    const abo = await contractTypeIdByCode('ABONNEMENT');
    const res = await request(app)
      .post('/api/v1/contracts')
      .set('Authorization', bearer(authA)) // DIRECTEUR, not an EDUCA admin
      .send({ contractTypeId: abo, title: 'Tentative', subjectSchoolId: targetSchool });
    expect(res.status).toBe(403);
  });
});
