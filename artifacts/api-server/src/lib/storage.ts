import { logger } from "./logger";

/**
 * Storage abstraction backed by Replit's GCS-based App Storage.
 * Presigned URLs are generated via the Replit sidecar — no SDK or extra
 * credentials required in either development or production.
 */

const REPLIT_SIDECAR = "http://127.0.0.1:1106";
const BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const SIGNED_URL_EXPIRES_SECONDS = 3600; // 1 hour for downloads
const UPLOAD_URL_EXPIRES_SECONDS = 900;  // 15 min for uploads

async function signObjectUrl(opts: {
  objectName: string;
  method: "GET" | "PUT" | "DELETE";
  ttlSec: number;
}): Promise<string> {
  if (!BUCKET) {
    throw new Error(
      "DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set — run setupObjectStorage() to provision the bucket."
    );
  }

  const response = await fetch(
    `${REPLIT_SIDECAR}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: BUCKET,
        object_name: opts.objectName,
        method: opts.method,
        expires_at: new Date(Date.now() + opts.ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Sidecar returned ${response.status} signing ${opts.method} URL: ${text}`
    );
  }

  const { signed_url: signedUrl } = (await response.json()) as {
    signed_url: string;
  };
  return signedUrl;
}

/**
 * Generate a presigned PUT URL for uploading a private file.
 * Returns { uploadUrl, storageKey } where storageKey is the permanent path.
 */
export async function generateUploadUrl(opts: {
  folder: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}): Promise<{ uploadUrl: string; storageKey: string }> {
  const ext = opts.fileName.split(".").pop() ?? "bin";
  const objectName = `uploads/${opts.folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const uploadUrl = await signObjectUrl({
    objectName,
    method: "PUT",
    ttlSec: UPLOAD_URL_EXPIRES_SECONDS,
  });

  logger.info({ objectName }, "Generated upload URL");
  return { uploadUrl, storageKey: objectName };
}

/**
 * Generate a short-lived signed GET URL for downloading a private asset.
 */
export async function generateDownloadUrl(storageKey: string): Promise<string> {
  return signObjectUrl({
    objectName: storageKey,
    method: "GET",
    ttlSec: SIGNED_URL_EXPIRES_SECONDS,
  });
}

/**
 * Delete a file from storage.
 */
export async function deleteStorageObject(storageKey: string): Promise<void> {
  try {
    const deleteUrl = await signObjectUrl({
      objectName: storageKey,
      method: "DELETE",
      ttlSec: 60,
    });
    await fetch(deleteUrl, { method: "DELETE" });
    logger.info({ storageKey }, "Storage object deleted");
  } catch (err) {
    logger.warn({ storageKey, err }, "Failed to delete storage object — ignoring");
  }
}
