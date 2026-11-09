import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import type pino from "pino";

export function errorHandler(logger: pino.Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      if (err.statusCode >= 500) logger.error({ err }, "app error");
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    logger.error({ err }, "unhandled error");
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  };
}
