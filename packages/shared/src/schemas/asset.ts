import { z } from "zod";
import { ASSET_KINDS } from "../constants/assets.js";
import { safeRelativePathSchema } from "./provider.js";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,100}$/;

export const createAssetSchema = z
  .object({
    stageId: z.string().regex(SAFE_ID, "Invalid stage id").optional(),
    kind: z.enum(ASSET_KINDS),
    relativePath: safeRelativePathSchema,
    mimeType: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type CreateAssetInput = z.output<typeof createAssetSchema>;
