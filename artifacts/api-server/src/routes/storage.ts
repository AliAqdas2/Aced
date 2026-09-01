import { z } from "zod";
import { Router, type IRouter, type Request, type Response } from "express";

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import {
  contentTypeFromKey,
  readStorageObject,
  writeStorageObject,
} from "../lib/localFs";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number(),
  contentType: z.string(),
});

function hasAuthenticatedSession(req: Request): boolean {
  return !!req.session?.userId;
}

function wildcardParam(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  return Array.isArray(raw) ? raw.join("/") : raw;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a local upload URL. The client sends JSON metadata (name, size,
 * contentType) — NOT the file — then PUTs the file to the returned URL.
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response) => {
    if (!hasAuthenticatedSession(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * PUT /storage/uploads/*
 *
 * Accept raw file bytes and write them under storage/<key>.
 * Body is parsed as raw Buffer via middleware in app.ts.
 */
router.put(
  "/storage/uploads/*storageKey",
  async (req: Request, res: Response) => {
    try {
      const storageKey = wildcardParam(req.params.storageKey);
      if (!storageKey) {
        res.status(400).json({ error: "Missing storage key" });
        return;
      }

      const body = req.body;
      const data = Buffer.isBuffer(body)
        ? body
        : Buffer.from(typeof body === "string" ? body : "");

      if (data.length === 0) {
        res.status(400).json({ error: "Empty upload body" });
        return;
      }

      await writeStorageObject(storageKey, data);
      res.status(200).json({ ok: true, storageKey });
    } catch (error) {
      req.log.error({ err: error }, "Error writing uploaded file");
      res.status(500).json({ error: "Failed to store upload" });
    }
  },
);

/**
 * GET /storage/files/*
 *
 * Serve any file by storage key (used for digital-product downloads).
 */
router.get(
  "/storage/files/*storageKey",
  async (req: Request, res: Response) => {
    try {
      const storageKey = wildcardParam(req.params.storageKey);
      const result = await readStorageObject(storageKey);
      if (!result) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      res.setHeader(
        "Content-Type",
        contentTypeFromKey(storageKey),
      );
      res.setHeader("Content-Length", String(result.size));
      res.setHeader("Cache-Control", "private, max-age=3600");
      result.stream.pipe(res);
    } catch (error) {
      req.log.error({ err: error }, "Error serving storage file");
      res.status(500).json({ error: "Failed to serve file" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from storage/public/.
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response) => {
    try {
      const filePath = wildcardParam(req.params.filePath);
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const response = await objectStorageService.downloadObject(file);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.stream) {
        response.stream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities (profile photos, banners). Public-read.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const wildcardPath = wildcardParam(req.params.path);
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.stream) {
      response.stream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
