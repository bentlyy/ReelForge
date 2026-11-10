import { Router } from "express";
import type { Db } from "../db/connection.js";
import { idParamSchema } from "@reel-engine/shared";
import * as queueSvc from "../services/jobQueueService.js";
import { badRequest } from "../lib/errors.js";

export function jobsRouter(db: Db) {
  const r = Router();
  r.get("/:id", (req, res, next) => {
    const p = idParamSchema.safeParse(req.params);
    if (!p.success) return next(badRequest("Invalid id"));
    try {
      res.json({ data: queueSvc.getJob(db, p.data.id) });
    } catch (e) {
      next(e);
    }
  });
  return r;
}
