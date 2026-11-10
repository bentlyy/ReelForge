import type { PipelineStageType } from "@reel-engine/shared";
import { PIPELINE_STAGE_TYPES } from "@reel-engine/shared";
import type { IStageProvider, ProviderConfigSource } from "./types.js";
import { StubStageProvider } from "./stubProvider.js";
import { ManualStageProvider } from "./manualProvider.js";

const key = (kind: string, stageType: string) => `${kind}:${stageType}`;

export class ProviderRegistry {
  private readonly providers = new Map<string, IStageProvider>();
  private readonly configSource?: ProviderConfigSource;
  private readonly onFallback?: (info: { stageType: PipelineStageType; requested: string }) => void;

  constructor(opts: { configSource?: ProviderConfigSource; onFallback?: (info: { stageType: PipelineStageType; requested: string }) => void } = {}) {
    this.configSource = opts.configSource;
    this.onFallback = opts.onFallback;
  }

  register(provider: IStageProvider): this {
    this.providers.set(key(provider.kind, provider.stageType), provider);
    return this;
  }

  get(stageType: PipelineStageType): IStageProvider {
    const provider = this.providers.get(key("stub", stageType));
    if (!provider) throw new Error(`No stub provider registered for ${stageType}`);
    return provider;
  }

  resolve(projectId: string | null, stageType: PipelineStageType): IStageProvider {
    const cfg = this.configSource?.getConfig(projectId, stageType) ?? null;
    const requested = cfg?.enabled === false ? "stub" : cfg?.providerKind ?? "stub";
    const found = this.providers.get(key(requested, stageType));
    if (found) return found;
    this.onFallback?.({ stageType, requested });
    return this.get(stageType);
  }
}

export function createDefaultRegistry(opts: { configSource?: ProviderConfigSource; onFallback?: (info: { stageType: PipelineStageType; requested: string }) => void } = {}): ProviderRegistry {
  const registry = new ProviderRegistry(opts);
  for (const stageType of PIPELINE_STAGE_TYPES) {
    registry.register(new StubStageProvider(stageType));
    registry.register(new ManualStageProvider(stageType));
  }
  return registry;
}
