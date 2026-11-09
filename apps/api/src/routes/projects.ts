import { Router } from "express";
import type { Db } from "../db/connection.js";
import { validateBody } from "../middleware/validate.js";
import { createProjectSchema, updateProjectSchema, idParamSchema } from "@reel-engine/shared";
import * as svc from "../services/projects.js";
import { badRequest } from "../lib/errors.js";

export function projectsRouter(db: Db) {
  const r = Router();
  r.get("/", (_req, res) => res.json({ data: svc.list(db) }));
  r.post("/", validateBody(createProjectSchema), (req, res) => res.status(201).json({ data: svc.create(db, req.body) }));
  r.get("/:id", (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try { res.json({ data: svc.get(db, p.data.id) }); } catch (e) { next(e); }
  });
  r.patch("/:id", validateBody(updateProjectSchema), (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try { res.json({ data: svc.update(db, p.data.id, req.body) }); } catch (e) { next(e); }
  });
  return r;
}
