import { Router } from "express";
import type { Db } from "../db/connection.js";
import { validateBody } from "../middleware/validate.js";
import { stageActionSchema, idParamSchema } from "@reel-engine/shared";
import * as stagesRepo from "../repositories/stages.js";
import * as pipeline from "../services/pipeline.js";
import * as queueSvc from "../services/jobQueueService.js";
import { badRequest, notFound } from "../lib/errors.js";

export function stagesRouter(db: Db) {
  const r = Router();
  r.get("/episode/:episodeId", (req, res, next) => {
    const p = zId(req.params.episodeId); if (!p) return next(badRequest("Invalid id"));
    try { res.json({ data: stagesRepo.ensureStages(db, p) }); } catch (e) { next(e); }
  });
  r.post("/:id/actions", validateBody(stageActionSchema), (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try {
      const { action, note } = req.body as { action: string; note: string };
      if (action === "start" || action === "complete") {
        // stub flow: start -> complete => WAITING_APPROVAL
        const stage = action === "start" ? pipeline.runStubStage(db, p.data.id).stage : pipeline.applyStageAction(db, p.data.id, "complete", note);
        return res.json({ data: stage });
      }
      const stage = pipeline.applyStageAction(db, p.data.id, action as any, note);
      res.json({ data: stage });
    } catch (e) { next(e); }
  });
  r.post("/:id/run-stub", (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try { res.json({ data: pipeline.runStubStage(db, p.data.id).stage }); } catch (e) { next(e); }
  });
  r.post("/:id/enqueue", (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try { res.status(202).json({ data: queueSvc.enqueueStage(db, p.data.id) }); } catch (e) { next(e); }
  });
  r.get("/:id/jobs", (req, res, next) => {
    const p = idParamSchema.safeParse(req.params); if (!p.success) return next(badRequest("Invalid id"));
    try { res.json({ data: queueSvc.listStageJobs(db, p.data.id) }); } catch (e) { next(e); }
  });
  return r;
}
function zId(v: string) { return /^[a-zA-Z0-9_-]+$/.test(v) ? v : null; }
