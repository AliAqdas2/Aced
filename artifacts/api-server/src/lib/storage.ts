import { logger } from "./logger";
import {
  deleteLocalStorageObject,
  localDownloadUrl,
  localUploadUrl,
} from "./localFs";

/**
 * Storage abstraction backed by the local filesystem under `<repo>/storage`.
 */

/**
 * Generate a PUT URL for uploading a private file.
 * Returns { uploadUrl, storageKey } where storageKey is the permanent path
 * relative to the storage root.
 */
export async function generateUploadUrl(opts: {
  folder: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}): Promise<{ uploadUrl: string; storageKey: string }> {
  const ext = opts.fileName.split(".").pop() ?? "bin";
  const storageKey = `uploads/${opts.folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const uploadUrl = localUploadUrl(storageKey);
  logger.info({ storageKey }, "Generated local upload URL");
  return { uploadUrl, storageKey };
}

/**
 * Generate a GET URL for downloading a private asset.
 */
export async function generateDownloadUrl(storageKey: string): Promise<string> {
  return localDownloadUrl(storageKey);
}

/**
 * Delete a file from local storage.
 */
export async function deleteStorageObject(storageKey: string): Promise<void> {
  try {
    await deleteLocalStorageObject(storageKey);
    logger.info({ storageKey }, "Storage object deleted");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn(
        { storageKey, err },
        "Failed to delete storage object — ignoring",
      );
    }
  }
}
