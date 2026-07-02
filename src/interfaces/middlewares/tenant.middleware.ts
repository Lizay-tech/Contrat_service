import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../../shared/config/env';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { runInTenantContext } from '../../infrastructure/database/tenant-context';

/**
 * Resolution du tenant RLS pour la requete.
 *
 * Regle: un administrateur EDUCA (roleCode dans EDUCA_ADMIN_ROLES) opere sous le
 * TENANT SYSTEME EDUCA (proprietaire des contrats d'etablissement). Tout autre
 * utilisateur opere sous SON ecole (schoolId du JWT).
 *
 * Consequence: le school_id du body/query est TOUJOURS ignore; seul le JWT
 * (via ce middleware) determine le tenant.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    throw new UnauthorizedError('Contexte d\'authentification absent');
  }
  const isEducaAdmin = env.educaAdminRoles.includes(req.auth.roleCode);
  req.tenantSchoolId = isEducaAdmin ? env.educaSystemTenantId : req.auth.schoolId;
  next();
}

/**
 * Enrobe un handler dans une transaction avec le tenant RLS positionne
 * (SET LOCAL app.tenant_school_id). Commit a la resolution, rollback a l'erreur.
 *
 * IMPORTANT: la reponse HTTP est BUFFERISEE puis emise UNIQUEMENT apres le commit
 * de la transaction. Sans cela, res.json() flush la reponse avant que la
 * transaction ne soit committee (le commit a lieu a la resolution du handler),
 * ouvrant une course lecture-apres-ecriture et le risque de repondre 201 pour
 * une ecriture qui echoue ensuite au commit.
 */
export function tenantHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    const tenant = req.tenantSchoolId;
    if (!tenant) {
      next(new UnauthorizedError('Tenant non resolu'));
      return;
    }

    const realStatus = res.status.bind(res);
    const realJson = res.json.bind(res);
    const realSend = res.send.bind(res);

    let statusCode = 200;
    let buffered: { kind: 'json' | 'send'; body: unknown } | null = null;

    // Capture (ne flush pas) pendant l'execution dans la transaction.
    res.status = ((code: number) => {
      statusCode = code;
      return res;
    }) as Response['status'];
    res.json = ((body: unknown) => {
      buffered = { kind: 'json', body };
      return res;
    }) as Response['json'];
    res.send = ((body: unknown) => {
      buffered = { kind: 'send', body };
      return res;
    }) as Response['send'];

    const restore = () => {
      res.status = realStatus;
      res.json = realJson;
      res.send = realSend;
    };

    runInTenantContext(tenant, () => Promise.resolve(fn(req, res, next)))
      .then(() => {
        // La transaction est committee: on emet la reponse capturee.
        restore();
        if (res.headersSent) return;
        res.status(statusCode);
        if (!buffered) {
          res.end();
        } else if (buffered.kind === 'json') {
          res.json(buffered.body);
        } else {
          res.send(buffered.body);
        }
      })
      .catch((err) => {
        restore();
        next(err);
      });
  };
}
