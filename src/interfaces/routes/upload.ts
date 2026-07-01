import multer from 'multer';
import { env } from '../../shared/config/env';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

/** In-memory upload (buffer handed to the storage adapter). PDF-first. */
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});
