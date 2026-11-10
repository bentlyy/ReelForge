import type { StageProviderConfig } from "../schemas/provider.js";

export interface ProviderConfigView {
  projectId: string | null;
  configs: StageProviderConfig[];
  effective: StageProviderConfig[];
}
