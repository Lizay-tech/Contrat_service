import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';

// --- Mocks des clients inter-services (aucun service live en test) ---
jest.mock('../src/infrastructure/clients/ecole.client', () => ({
  __esModule: true,
  getSchool: jest.fn(async () => ({
    identity: { nom: 'College Test', logo_url: 'http://logo' },
    contact: {
      adresse_ligne1: 'Rue Ecole',
      ville: 'Port-au-Prince',
      departement: 'Ouest',
      pays: 'Haiti',
      telephone: '+509 0000',
      email_officiel: 'ecole@test.ht',
    },
    meta: { code_ecole: 'EC1' },
    access: [{ contactResponsableNom: 'Mme Directrice' }],
  })),
}));
jest.mock('../src/infrastructure/clients/personnel.client', () => ({
  __esModule: true,
  getEmployee: jest.fn(async () => ({
    id: 'emp-1',
    prenom: 'Jean',
    nom: 'Baptiste',
    poste: 'Enseignant',
    ecole_id: 'school-1',
    matricule: 'M-001',
    date_naissance: '1990-01-01',
    nationalite: 'Haitienne',
    adresse: 'Rue X',
    telephone_principal: '+509 1111',
    email_professionnel: 'jean@test.ht',
    document_identite: { numero_carte_identite: 'CIN-1' },
    date_embauche: '2026-09-01',
    statut_professionnel: 'actif',
  })),
}));
jest.mock('../src/infrastructure/clients/academic-year.client', () => {
  const ayId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  return {
    __esModule: true,
    getActiveAcademicYear: jest.fn(async () => ({ id: ayId, name: '2025-2026' })),
    getActiveAcademicYearId: jest.fn(async () => ayId),
  };
});
jest.mock('../src/infrastructure/clients/affectation.client', () => ({
  __esModule: true,
  getAssignment: jest.fn(async () => null),
}));
jest.mock('../src/infrastructure/clients/user.client', () => ({
  __esModule: true,
  getUser: jest.fn(async () => null),
}));

import { createApp } from '../src/app';
import {
  bearer,
  closeDatabase,
  prepareDatabase,
  signToken,
  truncateBusinessTables,
} from './helpers';
import * as ecole from '../src/infrastructure/clients/ecole.client';

const API = '/api/v1';
let app: Express;
const schoolA = randomUUID();
const empId = randomUUID();
const token = () => signToken({ schoolId: schoolA, roleCode: 'SCHOOL_ADMIN' });

async function cdiTemplateId(): Promise<string> {
  const res = await request(app)
    .get(`${API}/templates?scopeOwner=PREDEFINED&limit=100`)
    .set('Authorization', bearer(token()));
  return res.body.data.items.find((t: { name: string }) => t.name.toLowerCase().includes('cdi')).id;
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

describe('Agregation - preview', () => {
  it('assemble le contexte et resout les variables depuis les services', async () => {
    const templateId = await cdiTemplateId();
    const res = await request(app)
      .get(`${API}/contracts/aggregate/preview?employeeId=${empId}&templateId=${templateId}`)
      .set('Authorization', bearer(token()));

    expect(res.status).toBe(200);
    expect(res.body.data.variables.school_name).toBe('College Test');
    expect(res.body.data.variables.employee_name).toBe('Jean Baptiste');
    expect(res.body.data.variables.employee_function).toBe('Enseignant');
    expect(res.body.data.variables.academic_year).toBe('2025-2026');
    expect(res.body.data.variables.director_name).toBe('Mme Directrice');
    expect(res.body.data.missingSources).toHaveLength(0);
    // employee_name/school_name resolus -> plus dans missingRequired
    const missingKeys = res.body.data.template.missingRequired.map((m: { key: string }) => m.key);
    expect(missingKeys).not.toContain('employee_name');
    expect(missingKeys).not.toContain('school_name');
  });

  it('degrade proprement si une source est indisponible (ecole null -> missing)', async () => {
    (ecole.getSchool as jest.Mock).mockResolvedValueOnce(null);
    const res = await request(app)
      .get(`${API}/contracts/aggregate/preview?employeeId=${empId}`)
      .set('Authorization', bearer(token()));
    expect(res.status).toBe(200);
    expect(res.body.data.missingSources).toContain('ecole');
    // Le contexte employe reste present malgre l'ecole absente
    expect(res.body.data.variables.employee_name).toBe('Jean Baptiste');
  });
});

describe('Agregation - creation depuis template', () => {
  it('pre-remplit ecole + employe dans le PDF (plus de variables vides)', async () => {
    const templateId = await cdiTemplateId();
    const res = await request(app)
      .post(`${API}/contracts/from-template`)
      .set('Authorization', bearer(token()))
      .send({
        templateId,
        employeeId: empId,
        startDate: '2026-09-01',
        amount: 25000,
        currency: 'HTG',
        variables: {},
        parties: [],
      });
    expect(res.status).toBe(201);
    const body = res.body.data.renderedBody as string;
    expect(body).toContain('Jean Baptiste');
    expect(body).toContain('College Test');
    expect(body).toContain('Mme Directrice');
    expect(body).toContain('vingt-cinq mille gourdes');
    // Variables persistees (jsonb) completes
    expect(res.body.data.metadata.variables.employee_name).toBe('Jean Baptiste');
  });

  it('donne la priorite aux valeurs saisies sur les valeurs agregees', async () => {
    const templateId = await cdiTemplateId();
    const res = await request(app)
      .post(`${API}/contracts/from-template`)
      .set('Authorization', bearer(token()))
      .send({
        templateId,
        employeeId: empId,
        startDate: '2026-09-01',
        variables: { employee_name: 'NOM SAISI MANUEL' },
        parties: [],
      });
    expect(res.status).toBe(201);
    const body = res.body.data.renderedBody as string;
    expect(body).toContain('NOM SAISI MANUEL');
    expect(body).not.toContain('Jean Baptiste');
  });
});
