import { z } from "zod";
import { PIPELINE_STAGE_TYPES } from "../constants/pipeline.js";

export const stageActionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel", "retry", "start", "complete"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export const stageTypeSchema = z.enum(PIPELINE_STAGE_TYPES);
export type StageActionInput = z.infer<typeof stageActionSchema>;
