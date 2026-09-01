import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream, existsSync } from "fs";
import type { Readable } from "stream";

/**
 * Resolve the monorepo root (directory containing pnpm-workspace.yaml),
 * then use `<root>/storage` as the local object store.
 */
function findRepoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export const STORAGE_ROOT = path.join(findRepoRoot(), "storage");

/**
 * Resolve a storage key to an absolute path under STORAGE_ROOT.
 * Throws if the key would escape the storage root (path traversal).
 */
export function resolveStoragePath(storageKey: string): string {
  const normalized = storageKey.replace(/^\/+/, "").replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.includes("..") ||
    path.isAbsolute(normalized)
  ) {
    throw new Error(`Invalid storage key: ${storageKey}`);
  }

  const absolute = path.resolve(STORAGE_ROOT, normalized);
  const rootWithSep = STORAGE_ROOT.endsWith(path.sep)
    ? STORAGE_ROOT
    : STORAGE_ROOT + path.sep;

  if (absolute !== STORAGE_ROOT && !absolute.startsWith(rootWithSep)) {
    throw new Error(`Invalid storage key (path traversal): ${storageKey}`);
  }

  return absolute;
}

export async function ensureStorageDir(storageKey: string): Promise<string> {
  const absolute = resolveStoragePath(storageKey);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  return absolute;
}

export async function writeStorageObject(
  storageKey: string,
  data: Buffer,
): Promise<void> {
  const absolute = await ensureStorageDir(storageKey);
  await fs.writeFile(absolute, data);
}

export async function readStorageObject(
  storageKey: string,
): Promise<{ stream: Readable; size: number } | null> {
  const absolute = resolveStoragePath(storageKey);
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) return null;
    return { stream: createReadStream(absolute), size: stat.size };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function storageObjectExists(storageKey: string): Promise<boolean> {
  const absolute = resolveStoragePath(storageKey);
  try {
    const stat = await fs.stat(absolute);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function deleteLocalStorageObject(
  storageKey: string,
): Promise<void> {
  const absolute = resolveStoragePath(storageKey);
  await fs.unlink(absolute);
}

/** Build a same-origin PUT URL for uploading into local storage. */
export function localUploadUrl(storageKey: string): string {
  return `/api/storage/uploads/${storageKey.replace(/^\/+/, "")}`;
}

/** Build a same-origin GET URL for downloading from local storage. */
export function localDownloadUrl(storageKey: string): string {
  return `/api/storage/files/${storageKey.replace(/^\/+/, "")}`;
}

/** Guess a content-type from a file extension. */
export function contentTypeFromKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".json": "application/json",
    ".txt": "text/plain",
  };
  return map[ext] ?? "application/octet-stream";
}
