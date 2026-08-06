import { AsyncLocalStorage } from 'node:async_hooks';
import type { Transaction } from 'sequelize';
import { sequelize } from './sequelize';

/**
 * Contexte de tenant propage par requete via AsyncLocalStorage.
 *
 * Le multi-tenant est garanti par la RLS PostgreSQL: chaque requete s'execute
 * dans UNE transaction ou l'on fixe `SET LOCAL app.tenant_school_id`. Les policies
 * RLS filtrent alors toutes les tables metier sur ce parametre de session.
 *
 * Les repositories recuperent la transaction courante via `currentTransaction()`
 * pour que toutes leurs requetes beneficient du filtre RLS (+ garde applicative).
 */
interface Store {
  tenantSchoolId: string;
  transaction: Transaction;
}

const storage = new AsyncLocalStorage<Store>();

/** Transaction de la requete courante (undefined hors contexte tenant). */
export function currentTransaction(): Transaction | undefined {
  return storage.getStore()?.transaction;
}

/** Tenant de la requete courante (undefined hors contexte tenant). */
export function currentTenant(): string | undefined {
  return storage.getStore()?.tenantSchoolId;
}

/**
 * Execute `fn` dans une transaction avec le tenant RLS positionne.
 * Commit si succes, rollback si erreur.
 */
export async function runInTenantContext<T>(
  tenantSchoolId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return sequelize.transaction(async (transaction) => {
    // SET LOCAL est limite a la transaction: pas de fuite entre requetes du pool.
    await sequelize.query('SET LOCAL app.tenant_school_id = :tenant', {
      replacements: { tenant: tenantSchoolId },
      transaction,
    });
    return storage.run({ tenantSchoolId, transaction }, fn);
  });
}
