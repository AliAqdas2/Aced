import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function createError(
  message: string,
  statusCode: number,
  code?: string
): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: "Not found",
    code: "NOT_FOUND",
    path: req.path,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const traceId = (req as any).id;

  if (statusCode >= 500) {
    req.log.error({ err, traceId }, "Unhandled server error");
  } else {
    req.log.warn({ err, traceId }, "Request error");
  }

  res.status(statusCode).json({
    error: err.message ?? "Internal server error",
    code: err.code ?? "INTERNAL_ERROR",
    traceId,
  });
}
