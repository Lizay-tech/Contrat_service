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
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(pinoHttp({ logger }));
  }

  app.use(env.apiPrefix, buildApiRouter());

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
