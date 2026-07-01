/**
 * Opaque transaction handle passed from the use-case layer down into the
 * repositories. Its concrete type (a Sequelize Transaction) lives in
 * infrastructure and is never referenced by application/domain code.
 */
export interface TxContext {
  readonly _brand: 'TxContext';
}

/**
 * Runs a unit of work inside a single DB transaction with the RLS session
 * variable `app.tenant_school_id` bound to `tenantSchoolId`. Every repository
 * call performed with the provided TxContext is therefore tenant-isolated.
 */
export interface IUnitOfWork {
  runInTenant<T>(
    tenantSchoolId: string,
    work: (tx: TxContext) => Promise<T>,
  ): Promise<T>;
}
