import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../../shared/config/env';

/**
 * Stockage documentaire local (Phase 1). L'interface est volontairement minimale
 * pour permettre un basculement futur vers un object storage (S3/OVH) sans
 * impacter la couche application.
 */
export interface StoredFile {
  filePath: string;
  sha256: string;
  sizeBytes: number;
}

function resolveRoot(): string {
  return path.resolve(env.storage.uploadDir);
}

export async function ensureStorageReady(): Promise<void> {
  await fs.mkdir(resolveRoot(), { recursive: true });
}

/** Calcule le sha256 d'un buffer (integrite documentaire). */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Persiste un buffer sous {uploadDir}/{tenant}/{contract}/{uniqueName}.
 * Retourne le chemin relatif a la racine de stockage + le hash + la taille.
 */
export async function saveDocument(params: {
  tenantSchoolId: string;
  contractId: string;
  uniqueName: string;
  buffer: Buffer;
}): Promise<StoredFile> {
  const relDir = path.join(params.tenantSchoolId, params.contractId);
  const absDir = path.join(resolveRoot(), relDir);
  await fs.mkdir(absDir, { recursive: true });

  const relPath = path.join(relDir, params.uniqueName);
  const absPath = path.join(resolveRoot(), relPath);
  await fs.writeFile(absPath, params.buffer);

  return {
    filePath: relPath.split(path.sep).join('/'),
    sha256: sha256(params.buffer),
    sizeBytes: params.buffer.length,
  };
}

/** Lit un document a partir de son chemin relatif. */
export async function readDocument(relPath: string): Promise<Buffer> {
  const absPath = path.join(resolveRoot(), relPath);
  return fs.readFile(absPath);
}
