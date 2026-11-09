import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { badRequest } from "../lib/errors.js";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return next(badRequest("Invalid request body", r.error.flatten()));
    req.body = r.data;
    next();
  };
}
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.query);
    if (!r.success) return next(badRequest("Invalid query", r.error.flatten()));
    (req as any).validatedQuery = r.data;
    next();
  };
}
