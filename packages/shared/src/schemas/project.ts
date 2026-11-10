import { z } from "zod";

const safeName = z.string().trim().min(1).max(120);
const safeDesc = z.string().trim().max(2000).optional().default("");

export const createProjectSchema = z.object({
  name: safeName,
  description: safeDesc,
  platform: z.enum(["youtube_shorts", "instagram_reels", "generic_vertical"]).default("youtube_shorts"),
});

export const updateProjectSchema = createProjectSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "At least one field required" },
);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
