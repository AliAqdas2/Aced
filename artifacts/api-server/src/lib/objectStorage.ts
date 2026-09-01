import { randomUUID } from "crypto";
import type { Readable } from "stream";

import {
  canAccessObject,
  ObjectAclPolicy,
  ObjectPermission,
  setObjectAclPolicy,
} from "./objectAcl";
import {
  contentTypeFromKey,
  localUploadUrl,
  readStorageObject,
  storageObjectExists,
} from "./localFs";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/** Local file handle returned by object storage lookups. */
export interface LocalObjectFile {
  storageKey: string;
  contentType: string;
}

export class ObjectStorageService {
  /**
   * Reserve a new object entity and return a same-origin PUT URL.
   * Files land at storage/objects/uploads/<uuid>.
   */
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const storageKey = `objects/uploads/${objectId}`;
    return localUploadUrl(storageKey);
  }

  /**
   * Convert an upload URL (or already-normalized path) to `/objects/...`.
   */
  normalizeObjectEntityPath(rawPath: string): string {
    // Already an object path
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    // Local upload URL: /api/storage/uploads/objects/uploads/<id>
    const localPrefix = "/api/storage/uploads/";
    if (rawPath.startsWith(localPrefix)) {
      const key = rawPath.slice(localPrefix.length);
      if (key.startsWith("objects/")) {
        return `/${key}`;
      }
      return `/objects/${key}`;
    }

    // Absolute URL — extract pathname and recurse
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      try {
        return this.normalizeObjectEntityPath(new URL(rawPath).pathname);
      } catch {
        return rawPath;
      }
    }

    // Bare storage key like objects/uploads/...
    if (rawPath.startsWith("objects/")) {
      return `/${rawPath}`;
    }

    return rawPath;
  }

  /** Map `/objects/...` → storage key `objects/...`. */
  objectPathToStorageKey(objectPath: string): string {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    return objectPath.slice(1); // drop leading slash
  }

  async getObjectEntityFile(objectPath: string): Promise<LocalObjectFile> {
    const storageKey = this.objectPathToStorageKey(objectPath);
    if (!(await storageObjectExists(storageKey))) {
      throw new ObjectNotFoundError();
    }
    return {
      storageKey,
      contentType: contentTypeFromKey(storageKey),
    };
  }

  async searchPublicObject(filePath: string): Promise<LocalObjectFile | null> {
    const storageKey = `public/${filePath.replace(/^\/+/, "")}`;
    if (!(await storageObjectExists(storageKey))) {
      return null;
    }
    return {
      storageKey,
      contentType: contentTypeFromKey(storageKey),
    };
  }

  async downloadObject(
    file: LocalObjectFile,
    cacheTtlSec: number = 3600,
  ): Promise<{
    status: number;
    headers: Map<string, string>;
    stream: Readable | null;
  }> {
    const result = await readStorageObject(file.storageKey);
    if (!result) {
      throw new ObjectNotFoundError();
    }

    const headers = new Map<string, string>([
      ["Content-Type", file.contentType || "application/octet-stream"],
      ["Cache-Control", `public, max-age=${cacheTtlSec}`],
      ["Content-Length", String(result.size)],
    ]);

    return { status: 200, headers, stream: result.stream };
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    await setObjectAclPolicy(normalizedPath, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: LocalObjectFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectPath: `/${objectFile.storageKey}`,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
