/**
 * Authenticated request context, derived EXCLUSIVELY from the verified JWT
 * (never from body/query). Attached to `req.auth` by the auth middleware.
 */
export interface AuthContext {
  /** JWT `userId` claim. */
  userId: string;
  /** JWT `schoolId` claim — the caller's own school. */
  schoolId: string;
  /** JWT `roleCode` claim. */
  roleCode: string;
}

/**
 * Tenant context resolved by the tenant middleware. `tenantSchoolId` is the RLS
 * key and is set as `app.tenant_school_id` on the PG session for the request.
 */
export interface TenantContext {
  tenantSchoolId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      tenant?: TenantContext;
      /** Correlation id for tracing / audit. */
      requestId?: string;
    }
  }
}

export {};
