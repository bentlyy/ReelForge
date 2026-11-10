import { Router } from "express";
import { z } from "zod";
import type { Db } from "../db/connection.js";
import { validateBody } from "../middleware/validate.js";
import { createAssetSchema } from "@reel-engine/shared";
import * as svc from "../services/assets.js";
import { badRequest } from "../lib/errors.js";

const episodeParamSchema = z.object({
  episodeId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});
const assetParamSchema = episodeParamSchema.extend({
  assetId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

export function assetsRouter(db: Db, storageRoot: string) {
  const r = Router({ mergeParams: true });
  r.get("/", (req, res, next) => {
    const p = episodeParamSchema.safeParse(req.params);
    if (!p.success) return next(badRequest("Invalid episode id"));
    try {
      res.json({ data: svc.listAssets(db, p.data.episodeId) });
    } catch (e) {
      next(e);
    }
  });
  r.post("/", validateBody(createAssetSchema), (req, res, next) => {
    const p = episodeParamSchema.safeParse(req.params);
    if (!p.success) return next(badRequest("Invalid episode id"));
    try {
      res.status(201).json({
        data: svc.createAsset(db, storageRoot, p.data.episodeId, req.body),
      });
    } catch (e) {
      next(e);
    }
  });
  r.delete("/:assetId", (req, res, next) => {
    const p = assetParamSchema.safeParse(req.params);
    if (!p.success) return next(badRequest("Invalid id"));
    try {
      res.json({ data: svc.deleteAsset(db, p.data.episodeId, p.data.assetId) });
    } catch (e) {
      next(e);
    }
  });
  return r;
}
