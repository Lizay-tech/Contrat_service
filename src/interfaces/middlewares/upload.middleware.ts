import multer from 'multer';
import { env } from '../../shared/config/env';

/**
 * Upload en memoire (le buffer est ensuite hashe puis persiste par file-storage).
 * Limite de taille configurable (MAX_UPLOAD_MB).
 */
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxUploadMb * 1024 * 1024 },
}).single('file');
