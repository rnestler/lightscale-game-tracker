import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { pool } from './db.js';
import type { Queryable } from './db.js';
import { inspectUploadedFile, UploadRefusedError } from './file-inspection.js';

export interface FileBlobInput {
  data: string;
  mimeType: string;
  fileName: string;
}

export interface FileReference {
  id: string;
  mimeType: string;
  fileName: string;
}

export interface StagedFile {
  id: string;
  blob: FileBlobInput;
}

export type FileBodyValue = FileBlobInput | FileReference | null;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const DOWNLOAD_CONTENT_TYPES: Partial<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

export function downloadContentType(fileName: string): string {
  return DOWNLOAD_CONTENT_TYPES[extname(fileName).toLowerCase()] ?? FALLBACK_CONTENT_TYPE;
}

export function isWithinUploadLimit(data: string): boolean {
  return Buffer.byteLength(data, 'base64') <= MAX_UPLOAD_BYTES;
}

export function isFileBodyValue(value: unknown): value is FileBodyValue {
  if (value === null) {
    return true;
  }
  if (typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['mimeType'] !== 'string' || typeof candidate['fileName'] !== 'string') {
    return false;
  }
  if (typeof candidate['data'] === 'string') {
    return isWithinUploadLimit(candidate['data']);
  }
  return typeof candidate['id'] === 'string';
}

async function loadFileMetadata(id: string): Promise<FileReference | null> {
  const { rows } = await pool.query(
    'SELECT "id", "mimeType", "fileName" FROM "$FILES" WHERE "id" = $1',
    [id]
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (row === undefined) {
    return null;
  }
  return {
    id: row['id'] as string,
    mimeType: row['mimeType'] as string,
    fileName: row['fileName'] as string,
  };
}

function stagedFileId(value: unknown, staged: StagedFile[]): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (!isFileBodyValue(value)) {
    throw new Error('Invalid file value: expected { data, mimeType, fileName } or { id }');
  }
  if ('data' in value) {
    const id = randomUUID();
    staged.push({ id, blob: value });
    return id;
  }
  return value.id;
}

export function stageFiles(
  body: Record<string, unknown>,
  fileFields: string[],
  staged: StagedFile[]
): void {
  const target = body;
  for (const fieldName of fileFields.filter((name) => target[name] !== undefined)) {
    const value = target[fieldName];
    target[fieldName] = Array.isArray(value)
      ? value.map((item) => stagedFileId(item, staged))
      : stagedFileId(value, staged);
  }
}

function refuseUnsafeUpload(blob: FileBlobInput): void {
  if (!isWithinUploadLimit(blob.data)) {
    throw new UploadRefusedError(
      413,
      'PAYLOAD_TOO_LARGE',
      'File exceeds the maximum upload size of 25 MB'
    );
  }
  const verdict = inspectUploadedFile(blob.fileName, Buffer.from(blob.data, 'base64'));
  if (verdict.kind === 'refused') {
    throw new UploadRefusedError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      `"${blob.fileName}": ${verdict.reason}`
    );
  }
}

export async function storeStagedFiles(client: Queryable, staged: StagedFile[]): Promise<void> {
  for (const { id, blob } of staged) {
    refuseUnsafeUpload(blob);
    await client.query(
      'INSERT INTO "$FILES" ("id", "mimeType", "fileName", "data") VALUES ($1, $2, $3, $4)',
      [id, blob.mimeType, blob.fileName, blob.data]
    );
  }
}

function loadStoredFile(id: unknown): Promise<FileReference | null> {
  if (typeof id !== 'string' || id.length === 0) {
    return Promise.resolve(null);
  }
  return loadFileMetadata(id);
}

async function loadFileList(ids: unknown[]): Promise<FileReference[]> {
  const files: FileReference[] = [];
  for (const id of ids) {
    const file = await loadStoredFile(id);
    if (file !== null) {
      files.push(file);
    }
  }
  return files;
}

export async function enrichRow(
  row: Record<string, unknown>,
  fileFields: string[]
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...row };
  for (const fieldName of fileFields) {
    const stored = row[fieldName];
    result[fieldName] = Array.isArray(stored)
      ? await loadFileList(stored)
      : await loadStoredFile(stored);
  }
  return result;
}
