<<<<<<< HEAD
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import multer from 'multer';
import { Container } from './infrastructure/container';
import { buildRouter } from './interfaces/routes';
import { requestId } from './interfaces/middlewares/requestId';
import { errorHandler, notFoundHandler } from './interfaces/middlewares/errorHandler';
import { fail } from './shared/http/response';
import { logger } from './shared/logger';

/** Builds the Express application (no network binding — used by tests too). */
export function createApp(container: Container): Express {
=======
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { env } from './shared/config/env';
import { logger } from './shared/config/logger';
import { buildApiRouter } from './interfaces/routes';
import {
  errorMiddleware,
  notFoundMiddleware,
} from './interfaces/middlewares/error.middleware';
// Import des associations Sequelize (effet de bord: enregistre les relations).
import './infrastructure/database/models';

/** Construit l'application Express (sans demarrer le serveur - testable). */
export function createApp(): Express {
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(helmet());
  app.use(cors());
  app.use(compression());
<<<<<<< HEAD
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { requestId?: string }).requestId ?? 'unknown',
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );

  app.use('/', buildRouter(container));

  // Multer-specific error translation (payload too large / bad file type).
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (err instanceof multer.MulterError) {
        return fail(res, 400, 'UPLOAD_ERROR', err.message);
      }
      if (err instanceof Error && err.message.startsWith('Unsupported file type')) {
        return fail(res, 400, 'UPLOAD_ERROR', err.message);
      }
      return next(err);
    },
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
=======
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(pinoHttp({ logger }));
  }

  app.use(env.apiPrefix, buildApiRouter());

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3

  return app;
}
