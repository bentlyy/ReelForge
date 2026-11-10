import type { Db } from "../db/connection.js";
import type { PipelineStatus } from "@reel-engine/shared";
import * as stagesRepo from "../repositories/stages.js";
import * as approvalsRepo from "../repositories/approvals.js";
import * as historyRepo from "../repositories/history.js";
import * as episodesRepo from "../repositories/episodes.js";
import * as jobQueue from "../repositories/jobQueue.js";
import { conflict, notFound } from "../lib/errors.js";
import { nowIso } from "../lib/id.js";

type Action = "start" | "complete" | "approve" | "reject" | "cancel" | "retry";

const ALLOWED: Record<Action, PipelineStatus[]> = {
  start: ["PENDING", "FAILED", "CANCELLED"],
  complete: ["RUNNING"],
  approve: ["WAITING_APPROVAL"],
  reject: ["WAITING_APPROVAL"],
  cancel: ["PENDING", "RUNNING", "WAITING_APPROVAL", "FAILED"],
  retry: ["FAILED", "CANCELLED"],
};

function targetStatus(action: Action): PipelineStatus {
  switch (action) {
    case "start": return "RUNNING";
    case "complete": return "WAITING_APPROVAL"; // Fase 1: completar requiere aprobación (sin proveedor real)
    case "approve": return "COMPLETED";
    case "reject": return "FAILED";
    case "cancel": return "CANCELLED";
    case "retry": return "PENDING";
  }
}

export function applyStageAction(db: Db, stageId: string, action: Action, note: string) {
  const tx = db.transaction(() => {
    const stage = stagesRepo.getStage(db, stageId);
    if (!stage) throw notFound("Stage not found");
    if (!ALLOWED[action].includes(stage.status)) {
      throw conflict(`Action ${action} not allowed from ${stage.status}`);
    }
    const next = targetStatus(action);
    const now = nowIso();
    const attempt = stagesRepo.latestAttempt(db, stageId);

    if (action === "start") {
      stagesRepo.createJob(db, stageId, "RUNNING", attempt + 1);
      stagesRepo.updateStage(db, stageId, { status: next, note, startedAt: stage.startedAt ?? now, completedAt: null });
      historyRepo.addEvent(db, { episodeId: stage.episodeId, eventType: "stage.started", message: `Stage ${stage.stageType} started`, metadata: { stageId, action } });
    } else if (action === "complete") {
      stagesRepo.createJob(db, stageId, "WAITING_APPROVAL", Math.max(1, attempt));
      stagesRepo.updateStage(db, stageId, { status: next, note });
      historyRepo.addEvent(db, { episodeId: stage.episodeId, eventType: "stage.waiting_approval", message: `Stage ${stage.stageType} waiting approval`, metadata: { stageId } });
    } else if (action === "approve") {
      approvalsRepo.createApproval(db, stageId, "APPROVED", note);
      stagesRepo.updateStage(db, stageId, { status: "COMPLETED", note, completedAt: now });
      historyRepo.addEvent(db, { episodeId: stage.episodeId, eventType: "stage.approved", message: `Stage ${stage.stageType} approved`, metadata: { stageId } });
    } else if (action === "reject") {
      approvalsRepo.createApproval(db, stageId, "REJECTED", note);
      stagesRepo.updateStage(db, stageId, { status: "FAILED", note });
      stagesRepo.createJob(db, stageId, "FAILED", Math.max(1, attempt), note || "Rejected");
      historyRepo.addEvent(db, { episodeId: stage.episodeId, eventType: "stage.rejected", message: `Stage ${stage.stageType} rejected`, metadata: { stageId } });
    } else if (action === "cancel") {
      const cancelledJobs = jobQueue.cancelActiveByStage(db, stageId);
      stagesRepo.updateStage(db, stageId, { status: "CANCELLED", note });
      historyRepo.addEvent(db, { episodeId: stage.episodeId, eventType: "stage.cancelled", message: `Stage ${stage.stageType} cancelled`, metadata: { stageId, cancelledJobs } });
    } else if (action === "retry") {
      stagesRepo.updateStage(db, stageId, { status: "PENDING", note, completedAt: null });
      historyRepo.addEvent(db, { episodeId: stage.episodeId, eventType: "stage.retry", message: `Stage ${stage.stageType} set to pending for retry`, metadata: { stageId } });
    }

    syncEpisodeStatus(db, stage.episodeId);
    return stagesRepo.getStage(db, stageId)!;
  });
  return tx();
}

export function syncEpisodeStatus(db: Db, episodeId: string): void {
  const stages = stagesRepo.listStages(db, episodeId);
  if (stages.length === 0) return;
  let status: PipelineStatus = "PENDING";
  if (stages.some((s) => s.status === "RUNNING")) status = "RUNNING";
  else if (stages.some((s) => s.status === "WAITING_APPROVAL")) status = "WAITING_APPROVAL";
  else if (stages.some((s) => s.status === "FAILED")) status = "FAILED";
  else if (stages.some((s) => s.status === "CANCELLED")) status = "CANCELLED";
  else if (stages.every((s) => s.status === "COMPLETED")) status = "COMPLETED";
  else if (stages.every((s) => s.status === "PENDING")) status = "PENDING";
  else status = "PENDING";
  episodesRepo.updateEpisode(db, episodeId, { status });
}

export function runStubStage(db: Db, stageId: string): { stage: any } {
  // D5: stub local sin proceso pesado/proveedor - start + complete => WAITING_APPROVAL
  applyStageAction(db, stageId, "start", "Stub run started");
  const stage = applyStageAction(db, stageId, "complete", "Stub run finished (no provider in Fase 1)");
  return { stage };
}
