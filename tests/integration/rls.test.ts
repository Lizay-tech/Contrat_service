import request from 'supertest';
import { Express } from 'express';
import { buildTestApp, publishedEvents } from '../helpers/app';
import { bearer } from '../helpers/jwt';
import { contractTypeIdByCode, prepareDatabase, truncateAll } from '../helpers/db';

const SCHOOL_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SCHOOL_B = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const authA = { userId: 'a0000000-0000-0000-0000-000000000001', schoolId: SCHOOL_A, roleCode: 'DIRECTEUR' };
const authB = { userId: 'c0000000-0000-0000-0000-000000000001', schoolId: SCHOOL_B, roleCode: 'DIRECTEUR' };

let app: Express;

beforeAll(async () => {
  await prepareDatabase();
  app = buildTestApp().app;
});

beforeEach(async () => {
  await truncateAll();
  publishedEvents.length = 0;
});

describe('Multi-tenant isolation (RLS)', () => {
  it('never lets one tenant see another tenant contracts', async () => {
    const cdi = await contractTypeIdByCode('CDI');

    const created = await request(app)
      .post('/api/v1/contracts')
      .set('Authorization', bearer(authA))
      .send({ contractTypeId: cdi, title: 'Contrat de A' });
    expect(created.status).toBe(201);
    const contractIdOfA = created.body.data.id;

    // Tenant B lists -> sees nothing from A.
    const listB = await request(app)
      .get('/api/v1/contracts')
      .set('Authorization', bearer(authB));
    expect(listB.status).toBe(200);
    expect(listB.body.data.total).toBe(0);
    expect(listB.body.data.items).toHaveLength(0);

    // Tenant B fetches A's contract by id -> 404 (invisible via RLS).
    const getB = await request(app)
      .get(`/api/v1/contracts/${contractIdOfA}`)
      .set('Authorization', bearer(authB));
    expect(getB.status).toBe(404);

    // Tenant A still sees its own contract.
    const listA = await request(app)
      .get('/api/v1/contracts')
      .set('Authorization', bearer(authA));
    expect(listA.body.data.total).toBe(1);
  });

  it('scopes the per-tenant contract number sequence independently', async () => {
    const cdi = await contractTypeIdByCode('CDI');

    const a1 = await request(app)
      .post('/api/v1/contracts')
      .set('Authorization', bearer(authA))
      .send({ contractTypeId: cdi, title: 'A-1' });
    const b1 = await request(app)
      .post('/api/v1/contracts')
      .set('Authorization', bearer(authB))
      .send({ contractTypeId: cdi, title: 'B-1' });

    // Both tenants start their own sequence at 00001.
    expect(a1.body.data.contractNumber).toMatch(/-00001$/);
    expect(b1.body.data.contractNumber).toMatch(/-00001$/);
  });
});
