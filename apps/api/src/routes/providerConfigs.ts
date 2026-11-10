import { Router, type Request } from "express";
import { z } from "zod";
import type { Db } from "../db/connection.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  PIPELINE_STAGE_TYPES,
  stageProviderConfigUpdateSchema,
} from "@reel-engine/shared";
import * as svc from "../services/providerConfigs.js";
import { badRequest } from "../lib/errors.js";

const querySchema = z
  .object({
    projectId: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

const stageParamSchema = z.object({ stageType: z.enum(PIPELINE_STAGE_TYPES) });

function scope(req: Request): string | null {
  return ((req as any).validatedQuery as { projectId?: string } | undefined)?.projectId ?? null;
}

export function providerConfigsRouter(db: Db) {
  const r = Router();
  r.get("/", validateQuery(querySchema), (req, res, next) => {
    try {
      res.json({ data: svc.getProviderConfigView(db, scope(req)) });
    } catch (e) {
      next(e);
    }
  });
  r.put(
    "/:stageType",
    validateQuery(querySchema),
    validateBody(stageProviderConfigUpdateSchema),
    (req, res, next) => {
      const p = stageParamSchema.safeParse(req.params);
      if (!p.success) return next(badRequest("Invalid stage type"));
      try {
        res.json({
          data: svc.upsertProviderConfig(db, scope(req), p.data.stageType, req.body),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  r.delete("/:stageType", validateQuery(querySchema), (req, res, next) => {
    const p = stageParamSchema.safeParse(req.params);
    if (!p.success) return next(badRequest("Invalid stage type"));
    try {
      res.json({ data: svc.deleteProviderConfig(db, scope(req), p.data.stageType) });
    } catch (e) {
      next(e);
    }
  });
  return r;
}
