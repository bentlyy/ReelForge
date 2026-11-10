export const qk = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  episodes: (projectId?: string) => ["episodes", projectId || "all"] as const,
  episode: (id: string) => ["episodes", "detail", id] as const,
  history: (episodeId?: string) => ["history", episodeId || "all"] as const,
  providerConfigs: (projectId?: string | null) =>
    ["provider-configs", projectId || "global"] as const,
  assets: (episodeId: string) => ["assets", episodeId] as const,
};
