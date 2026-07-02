import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';

// Mock du client signature-service (pas de 8093 live en test).
jest.mock('../src/infrastructure/clients/signature.client', () => {
  class SignatureServiceError extends Error {}
  const defaultSig = {
    id: 'sig-default-1',
    display_name: 'Ma signature',
    signature_type: 'TEXT',
    signature_text: 'J. Baptiste',
    is_default: true,
    status: 'ACTIVE',
  };
  return {
    __esModule: true,
    SignatureServiceError,
    listUserSignatures: jest.fn(async () => [defaultSig]),
    getDefaultSignature: jest.fn(async () => defaultSig),
    getSignature: jest.fn(async () => defaultSig),
    getSignatureImage: jest.fn(async () => null),
    recordUsage: jest.fn(async () => 'usage-1'),
  };
});

import { createApp } from '../src/app';
import {
  bearer,
  closeDatabase,
  prepareDatabase,
  signToken,
  truncateBusinessTables,
} from './helpers';
import * as sigClient from '../src/infrastructure/clients/signature.client';

const API = '/api/v1';
let app: Express;

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

async function predefinedTemplateId(token: string, contains: string): Promise<string> {
  const res = await request(app)
    .get(`${API}/templates?scopeOwner=PREDEFINED&limit=100`)
    .set('Authorization', bearer(token));
  const found = res.body.data.items.find((t: { name: string }) =>
    t.name.toLowerCase().includes(contains),
  );
  if (!found) throw new Error(`Template predefini ${contains} introuvable`);
  return found.id;
}

describe('Modeles de contrat (templates)', () => {
  const schoolA = randomUUID();
  const admin = () => signToken({ schoolId: schoolA, roleCode: 'SCHOOL_ADMIN' });

  it('expose les 7 modeles predefinis, lisibles par toute ecole', async () => {
    const res = await request(app)
      .get(`${API}/templates?scopeOwner=PREDEFINED&limit=100`)
      .set('Authorization', bearer(admin()));
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(7);
  });

  it('clone un modele predefini en modele SCHOOL editable puis le publie', async () => {
    const srcId = await predefinedTemplateId(admin(), 'cdi');
    const dup = await request(app)
      .post(`${API}/templates/${srcId}/duplicate`)
      .set('Authorization', bearer(admin()))
      .send({ name: 'Mon CDI ecole' });
    expect(dup.status).toBe(201);
    expect(dup.body.data.scopeOwner).toBe('SCHOOL');
    expect(dup.body.data.tenantSchoolId).toBe(schoolA);

    const pub = await request(app)
      .post(`${API}/templates/${dup.body.data.id}/publish`)
      .set('Authorization', bearer(admin()));
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('PUBLISHED');
    expect(pub.body.data.currentVersion).toBe(1);
  });

  it('refuse la creation de modele a un role non gestionnaire (403)', async () => {
    const res = await request(app)
      .post(`${API}/templates`)
      .set('Authorization', bearer(signToken({ schoolId: schoolA, roleCode: 'ENSEIGNANT' })))
      .send({ name: 'X', body: '<p>{{employee_name}}</p>' });
    expect(res.status).toBe(403);
  });

  it('isole les modeles SCHOOL entre tenants (RLS) mais partage les predefinis', async () => {
    const dup = await request(app)
      .post(`${API}/templates/${await predefinedTemplateId(admin(), 'stage')}/duplicate`)
      .set('Authorization', bearer(admin()))
      .send({ name: 'Stage prive A' });
    const idA = dup.body.data.id;

    const schoolB = signToken({ schoolId: randomUUID(), roleCode: 'SCHOOL_ADMIN' });
    const detailB = await request(app)
      .get(`${API}/templates/${idA}`)
      .set('Authorization', bearer(schoolB));
    expect(detailB.status).toBe(404);

    // B voit tout de meme les predefinis
    const predefB = await request(app)
      .get(`${API}/templates?scopeOwner=PREDEFINED`)
      .set('Authorization', bearer(schoolB));
    expect(predefB.body.data.items.length).toBeGreaterThanOrEqual(7);
  });

  it('previsualise le rendu avec des donnees d exemple', async () => {
    const id = await predefinedTemplateId(admin(), 'cdi');
    const res = await request(app)
      .post(`${API}/templates/${id}/preview`)
      .set('Authorization', bearer(admin()))
      .send({ sampleData: { employee_name: 'Marie Claire', school_name: 'College Test' } });
    expect(res.status).toBe(200);
    expect(res.body.data.html).toContain('Marie Claire');
    expect(res.body.data.html).not.toContain('{{employee_name}}');
  });
});

describe('Contrat depuis template + PDF', () => {
  const schoolA = randomUUID();
  const admin = () => signToken({ schoolId: schoolA, roleCode: 'SCHOOL_ADMIN' });

  it('cree un contrat rendu depuis un modele et genere le PDF', async () => {
    const templateId = await predefinedTemplateId(admin(), 'cdi');
    const created = await request(app)
      .post(`${API}/contracts/from-template`)
      .set('Authorization', bearer(admin()))
      .send({
        templateId,
        title: 'CDI Jean',
        startDate: '2026-09-01',
        amount: 25000,
        currency: 'HTG',
        variables: {
          employee_name: 'Jean Baptiste',
          employee_function: 'Enseignant',
          school_name: 'College Test',
          director_name: 'Mme Directrice',
        },
        parties: [
          { partyType: 'PERSON', roleInContract: 'EMPLOYE', fullName: 'Jean Baptiste' },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.templateId).toBe(templateId);
    expect(created.body.data.renderedBody).toContain('Jean Baptiste');
    expect(created.body.data.renderedBody).toContain('vingt-cinq mille gourdes');
    expect(created.body.data.documents.length).toBeGreaterThanOrEqual(1);

    const pdf = await request(app)
      .get(`${API}/contracts/${created.body.data.id}/pdf`)
      .set('Authorization', bearer(admin()));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('refuse la creation si une variable requise manque (400)', async () => {
    const templateId = await predefinedTemplateId(admin(), 'cdi');
    const res = await request(app)
      .post(`${API}/contracts/from-template`)
      .set('Authorization', bearer(admin()))
      .send({ templateId, variables: { employee_name: 'Jean' }, parties: [] });
    expect(res.status).toBe(400);
  });
});

describe('Cycle de signature -> ACTIVE', () => {
  const schoolA = randomUUID();
  const admin = () => signToken({ schoolId: schoolA, roleCode: 'SCHOOL_ADMIN' });

  async function createApprovedContract(): Promise<string> {
    const typesRes = await request(app)
      .get(`${API}/contract-types`)
      .set('Authorization', bearer(admin()));
    const typeId = typesRes.body.data.find((t: { code: string }) => t.code === 'PERSONNEL_CDI').id;
    const created = await request(app)
      .post(`${API}/contracts`)
      .set('Authorization', bearer(admin()))
      .send({ contractTypeId: typeId, title: 'A signer' });
    const id = created.body.data.id;
    for (const toStatus of ['PENDING_APPROVAL', 'APPROVED']) {
      const tr = await request(app)
        .post(`${API}/contracts/${id}/transition`)
        .set('Authorization', bearer(admin()))
        .send({ toStatus });
      expect(tr.status).toBe(200);
      expect(tr.body.data.status).toBe(toStatus);
    }
    return id;
  }

  async function openRequest(contractId: string): Promise<{ requestId: string; signatories: Array<{ id: string }> }> {
    const reqRes = await request(app)
      .post(`${API}/contracts/${contractId}/signature-requests`)
      .set('Authorization', bearer(admin()))
      .send({
        mode: 'PARALLEL',
        signatories: [
          { name: 'Employeur', email: 'employeur@test.ht' },
          { name: 'Employe', email: 'employe@test.ht' },
        ],
      });
    expect(reqRes.status).toBe(201);
    return { requestId: reqRes.body.data.id, signatories: reqRes.body.data.signatories };
  }

  it('liste les signatures disponibles avec le flag par defaut', async () => {
    const contractId = await createApprovedContract();
    const res = await request(app)
      .get(`${API}/contracts/${contractId}/available-signatures`)
      .set('Authorization', bearer(admin()));
    expect(res.status).toBe(200);
    expect(res.body.data[0].isDefault).toBe(true);
  });

  it('refuse la signature sans confirmation (422)', async () => {
    const contractId = await createApprovedContract();
    const { requestId, signatories } = await openRequest(contractId);
    const res = await request(app)
      .post(`${API}/signature-requests/${requestId}/sign`)
      .set('Authorization', bearer(admin()))
      .send({ signatoryId: signatories[0].id }); // confirmed absent
    expect(res.status).toBe(422);
  });

  it('renvoie 409 si aucune signature par defaut', async () => {
    (sigClient.getDefaultSignature as jest.Mock).mockResolvedValueOnce(null);
    const contractId = await createApprovedContract();
    const { requestId, signatories } = await openRequest(contractId);
    const res = await request(app)
      .post(`${API}/signature-requests/${requestId}/sign`)
      .set('Authorization', bearer(admin()))
      .send({ signatoryId: signatories[0].id, confirmed: true });
    expect(res.status).toBe(409);
  });

  it('signe avec la signature par defaut, appose un doc SIGNE et passe ACTIVE', async () => {
    const contractId = await createApprovedContract();
    const { requestId, signatories } = await openRequest(contractId);

    // Le contrat est passe en PENDING_SIGNATURE
    const midStatus = await request(app)
      .get(`${API}/contracts/${contractId}`)
      .set('Authorization', bearer(admin()));
    expect(midStatus.body.data.status).toBe('PENDING_SIGNATURE');

    // Signature des deux (confirmée, signature par défaut)
    for (const s of signatories) {
      const sign = await request(app)
        .post(`${API}/signature-requests/${requestId}/sign`)
        .set('Authorization', bearer(admin()))
        .send({ signatoryId: s.id, confirmed: true });
      expect(sign.status).toBe(200);
      expect(sign.body.data.signedDocumentId).toBeTruthy();
    }

    // L'usage a été enregistré côté signature-service
    expect(sigClient.recordUsage as jest.Mock).toHaveBeenCalled();

    const finalStatus = await request(app)
      .get(`${API}/contracts/${contractId}`)
      .set('Authorization', bearer(admin()));
    expect(finalStatus.body.data.status).toBe('ACTIVE');

    // Un document SIGNE a bien été généré
    const signedDocs = finalStatus.body.data.documents.filter(
      (d: { type: string }) => d.type === 'SIGNE',
    );
    expect(signedDocs.length).toBeGreaterThanOrEqual(1);
  });
});
