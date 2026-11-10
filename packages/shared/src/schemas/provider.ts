import { z } from "zod";
import { PIPELINE_STAGE_TYPES } from "../constants/pipeline.js";
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  JOB_RESULT_STATUSES,
  PROVIDER_KINDS,
} from "../constants/providers.js";

const SAFE_ENV_REF = /^[A-Z][A-Z0-9_]{0,80}$/;

export const safeRelativePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((p) => !p.includes("\0"), "path must not contain null bytes")
  .refine((p) => !p.includes("\\"), "path must use forward slashes")
  .refine((p) => !/^([a-zA-Z]:|\/)/.test(p), "path must be relative")
  .refine(
    (p) => p.split("/").every((seg) => seg !== "" && seg !== "." && seg !== ".."),
    "path must not contain empty, '.' or '..' segments",
  );

export const assetRefSchema = z
  .object({
    kind: z.string().trim().min(1).max(60),
    relativePath: safeRelativePathSchema,
    mimeType: z.string().trim().max(120).optional(),
    sizeBytes: z.number().int().min(0).optional(),
  })
  .strict();

export const stageProviderConfigSchema = z
  .object({
    stageType: z.enum(PIPELINE_STAGE_TYPES),
    providerKind: z.enum(PROVIDER_KINDS),
    enabled: z.boolean().default(true),
    configRef: z
      .string()
      .regex(SAFE_ENV_REF, "configRef must be an env var name, never a secret value")
      .optional(),
    timeoutMs: z.number().int().min(1000).max(3_600_000).default(DEFAULT_PROVIDER_TIMEOUT_MS),
    maxAttempts: z.number().int().min(1).max(10).default(DEFAULT_MAX_ATTEMPTS),
  })
  .strict();

export const jobResultSchema = z
  .object({
    status: z.enum(JOB_RESULT_STATUSES),
    output: z.record(z.unknown()).optional(),
    assets: z.array(assetRefSchema).max(200).optional(),
    errorCode: z.string().trim().max(80).optional(),
    errorMessage: z.string().trim().max(2000).optional(),
  })
  .strict();

export const stageProviderConfigUpdateSchema = stageProviderConfigSchema
  .omit({ stageType: true })
  .strict();

export type StageProviderConfigInput = z.input<typeof stageProviderConfigSchema>;
export type StageProviderConfig = z.output<typeof stageProviderConfigSchema>;
export type StageProviderConfigUpdate = z.output<typeof stageProviderConfigUpdateSchema>;
export type AssetRef = z.infer<typeof assetRefSchema>;
export type JobResult = z.infer<typeof jobResultSchema>;
