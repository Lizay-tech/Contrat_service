import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../src/shared/config/env';
import { sequelize } from '../src/infrastructure/database/sequelize';
import { migrator } from '../src/infrastructure/database/migrate';
import { seeder } from '../src/infrastructure/database/seed';

export function signToken(claims: {
  userId?: string;
  schoolId: string;
  roleCode: string;
}): string {
  return jwt.sign(
    { userId: claims.userId ?? randomUUID(), schoolId: claims.schoolId, roleCode: claims.roleCode },
    env.jwtSecret,
    { expiresIn: '1h' },
  );
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

/** Prepare la base de test: schema (migrations) + referentiels (seeders). */
export async function prepareDatabase(): Promise<void> {
  await sequelize.authenticate();
  await migrator.up();
  await seeder.up();
}

/** Vide les tables metier entre les tests (TRUNCATE echappe a la RLS - owner). */
export async function truncateBusinessTables(): Promise<void> {
  await sequelize.query(`
    TRUNCATE TABLE
      audit_logs,
      contract_status_history,
      contract_documents,
      contract_parties,
      contracts
    RESTART IDENTITY CASCADE;
  `);
}

export async function closeDatabase(): Promise<void> {
  await sequelize.close();
}
