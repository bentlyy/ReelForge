import type { JobRequest, JobResult, PipelineStageType, ProviderKind } from "@reel-engine/shared";
import { stageProviderConfigSchema } from "@reel-engine/shared";
import type { IStageProvider, ProviderContext } from "./types.js";

export class StubStageProvider implements IStageProvider {
  readonly kind: ProviderKind = "stub";

  constructor(readonly stageType: PipelineStageType) {}

  validateConfig(cfg: unknown): void {
    if (cfg == null) return;
    stageProviderConfigSchema.parse({
      ...(cfg as Record<string, unknown>),
      stageType: this.stageType,
      providerKind: this.kind,
    });
  }

  async run(req: JobRequest, ctx: ProviderContext): Promise<JobResult> {
    ctx.logger.debug({ jobId: req.jobId, stageType: this.stageType }, "stub provider run");
    return {
      status: "WAITING_APPROVAL",
      output: { stub: true, stageType: this.stageType, attempt: req.attempt },
    };
  }
}
