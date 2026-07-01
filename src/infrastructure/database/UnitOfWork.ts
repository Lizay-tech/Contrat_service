import { Transaction } from 'sequelize';
import { IUnitOfWork, TxContext } from '../../application/ports/TxContext';
import { sequelize } from './sequelize';

/**
 * Concrete TxContext wrapping a Sequelize transaction. Repositories unwrap it
 * via `SequelizeTx.unwrap(tx)`.
 */
export class SequelizeTx implements TxContext {
  readonly _brand = 'TxContext' as const;
  constructor(public readonly transaction: Transaction) {}

  static unwrap(tx: TxContext): Transaction {
    return (tx as SequelizeTx).transaction;
  }
}

/**
 * Runs each unit of work inside one transaction, binding the RLS session
 * variable `app.tenant_school_id` for its lifetime via SET LOCAL (through
 * set_config(..., is_local => true)). This is what makes every repository call
 * within the callback tenant-isolated.
 */
export class SequelizeUnitOfWork implements IUnitOfWork {
  async runInTenant<T>(
    tenantSchoolId: string,
    work: (tx: TxContext) => Promise<T>,
  ): Promise<T> {
    return sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `SELECT set_config('app.tenant_school_id', :tenant, true)`,
        {
          replacements: { tenant: tenantSchoolId },
          transaction,
        },
      );
      return work(new SequelizeTx(transaction));
    });
  }
}
