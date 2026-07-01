import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { IFileStorage, StoredFile } from '../../application/ports/services';
import { env } from '../../shared/config/env';

/**
 * Stores documents on the local filesystem (mounted volume in Docker). Files are
 * laid out per tenant/contract and named by their sha256 to be content-addressed
 * and collision-safe. Swap this adapter for an S3-backed one without touching
 * the use-cases (both implement IFileStorage).
 */
export class LocalFileStorage implements IFileStorage {
  constructor(private readonly baseDir: string = env.storage.uploadDir) {}

  private safeExt(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
  }

  async save(params: {
    tenantSchoolId: string;
    contractId: string;
    originalName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<StoredFile> {
    const sha256Hash = createHash('sha256').update(params.buffer).digest('hex');
    const ext = this.safeExt(params.originalName);
    const dir = path.join(this.baseDir, params.tenantSchoolId, params.contractId);
    await fs.mkdir(dir, { recursive: true });

    const fileName = `${sha256Hash}${ext}`;
    const absPath = path.join(dir, fileName);
    await fs.writeFile(absPath, params.buffer);

    // Store a path relative to baseDir so the DB is portable across mounts.
    const relPath = path.relative(this.baseDir, absPath).split(path.sep).join('/');

    return {
      filePath: relPath,
      sizeBytes: params.buffer.length,
      sha256Hash,
      mimeType: params.mimeType,
    };
  }

  async read(filePath: string): Promise<Buffer> {
    const absPath = path.join(this.baseDir, filePath);
    return fs.readFile(absPath);
  }
}
