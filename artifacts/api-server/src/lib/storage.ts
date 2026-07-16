import { logger } from "./logger";

/**
 * Storage abstraction for private S3-compatible object storage.
 * Returns signed URLs for upload and download operations.
 * In development, returns mock URLs.
 * Production dynamically imports AWS SDK to avoid a hard install dependency.
 */

const BUCKET = process.env.STORAGE_BUCKET ?? "aced-assets";
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT ?? "";
const STORAGE_KEY_ID = process.env.STORAGE_KEY_ID ?? "";
const STORAGE_SECRET = process.env.STORAGE_SECRET ?? "";
const SIGNED_URL_EXPIRES_SECONDS = 3600; // 1 hour for downloads
const UPLOAD_URL_EXPIRES_SECONDS = 900; // 15 min for uploads

function isDev(): boolean {
  return process.env.NODE_ENV !== "production" || !STORAGE_ENDPOINT;
}

function buildClient(): any {
  // Imported dynamically — avoid hard SDK dependency at build time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    endpoint: STORAGE_ENDPOINT,
    credentials: { accessKeyId: STORAGE_KEY_ID, secretAccessKey: STORAGE_SECRET },
    region: process.env.STORAGE_REGION ?? "auto",
    forcePathStyle: true,
  });
}

/**
 * Generate a signed URL for uploading a private file.
 * Returns { uploadUrl, storageKey } where storageKey is the permanent path.
 */
export async function generateUploadUrl(opts: {
  folder: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}): Promise<{ uploadUrl: string; storageKey: string }> {
  const ext = opts.fileName.split(".").pop() ?? "bin";
  const storageKey = `${opts.folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  if (isDev()) {
    logger.info({ storageKey }, "DEV: mock upload URL");
    return {
      uploadUrl: `http://localhost:9000/${BUCKET}/${storageKey}?mock=1`,
      storageKey,
    };
  }

  // Production: require AWS SDK (installed separately in prod env)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

  const client = buildClient();
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
    ContentType: opts.mimeType,
  });

  const uploadUrl: string = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
  });

  return { uploadUrl, storageKey };
}

/**
 * Generate a short-lived signed download URL for a private asset.
 */
export async function generateDownloadUrl(storageKey: string): Promise<string> {
  if (isDev()) {
    logger.info({ storageKey }, "DEV: mock download URL");
    return `http://localhost:9000/${BUCKET}/${storageKey}?mock=1&expires=${Date.now() + SIGNED_URL_EXPIRES_SECONDS * 1000}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

  const client = buildClient();
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: storageKey });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_EXPIRES_SECONDS });
}

/**
 * Delete a file from storage (used during cleanup).
 */
export async function deleteStorageObject(storageKey: string): Promise<void> {
  if (isDev()) {
    logger.info({ storageKey }, "DEV: mock delete");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

  const client = new S3Client({
    endpoint: STORAGE_ENDPOINT,
    credentials: { accessKeyId: STORAGE_KEY_ID, secretAccessKey: STORAGE_SECRET },
    region: process.env.STORAGE_REGION ?? "auto",
    forcePathStyle: true,
  });

  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }));
}
