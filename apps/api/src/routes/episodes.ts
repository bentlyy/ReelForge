import { Router } from "express";
import type { Db } from "../db/connection.js";
import { validateBody } from "../middleware/validate.js";
import { createEpisodeSchema, updateEpisodeSchema, idParamSchema } from "@reel-engine/shared";
import * as svc from "../services/episodes.js";
import { badRequest } from "../lib/errors.js";
import { z } from "zod";

export function episodesRouter(db: Db) {
  const r = Router();
  r.get("/", (req, res) => {
    const q = z.object({ projectId: z.string().optional() }).safeParse(req.query);
    res.json({ data: svc.list(db, q.success ? q.data.projectId : undefined) });
  });
  r.post("/", validateBody(createEpisodeSchema), (req, res, next) => {
    try { res.status(201).json({ data: svc.create(db, req.body) }); } catch (e) { next(e); }
  });
  r.get("/:id", (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try { res.json({ data: svc.get(db, p.data.id) }); } catch (e) { next(e); }
  });
  r.patch("/:id", validateBody(updateEpisodeSchema), (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try { res.json({ data: svc.update(db, p.data.id, req.body) }); } catch (e) { next(e); }
  });
  return r;
}
