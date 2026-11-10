import { z } from "zod";

const safeTitle = z.string().trim().min(1).max(160);
const safeText = z.string().trim().max(5000).optional().default("");

export const createEpisodeSchema = z.object({
  projectId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  title: safeTitle,
  synopsis: safeText,
});

export const updateEpisodeSchema = z.object({
  title: safeTitle.optional(),
  synopsis: safeText,
}).refine((v) => v.title !== undefined || v.synopsis !== undefined, {
  message: "At least one field required",
});

export type CreateEpisodeInput = z.infer<typeof createEpisodeSchema>;
export type UpdateEpisodeInput = z.infer<typeof updateEpisodeSchema>;
