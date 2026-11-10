import fs from "node:fs";
import path from "node:path";
import type { Db } from "../db/connection.js";
import type { CreateAssetInput } from "@reel-engine/shared";
import * as repo from "../repositories/assets.js";
import * as episodesRepo from "../repositories/episodes.js";
import * as stagesRepo from "../repositories/stages.js";
import * as history from "../repositories/history.js";
import { badRequest, notFound } from "../lib/errors.js";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".srt": "text/plain",
  ".vtt": "text/vtt",
  ".json": "application/json",
  ".txt": "text/plain",
};

function requireEpisode(db: Db, episodeId: string) {
  const episode = episodesRepo.getEpisode(db, episodeId);
  if (!episode) throw notFound("Episode not found");
  return episode;
}

function resolveStoredFile(storageRoot: string, episodeId: string, relativePath: string) {
  const prefix = `episodes/${episodeId}/`;
  if (!relativePath.startsWith(prefix)) {
    throw badRequest(`relativePath must be under ${prefix}`);
  }
  const root = path.resolve(storageRoot);
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(root + path.sep)) {
    throw badRequest("Path escapes storage root");
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(full);
  } catch {
    throw badRequest("Asset file not found under storage root");
  }
  if (!stat.isFile()) throw badRequest("Asset path is not a file");
  return { full, sizeBytes: stat.size };
}

export function listAssets(db: Db, episodeId: string) {
  requireEpisode(db, episodeId);
  return repo.listAssets(db, episodeId);
}

export function createAsset(
  db: Db,
  storageRoot: string,
  episodeId: string,
  input: CreateAssetInput,
) {
  const episode = requireEpisode(db, episodeId);
  let stageId: string | null = null;
  if (input.stageId) {
    const stage = stagesRepo.getStage(db, input.stageId);
    if (!stage || stage.episodeId !== episodeId) {
      throw badRequest("Stage does not belong to episode");
    }
    stageId = stage.id;
  }

  const { sizeBytes } = resolveStoredFile(storageRoot, episodeId, input.relativePath);
  const mimeType =
    input.mimeType ?? MIME_BY_EXT[path.extname(input.relativePath).toLowerCase()] ?? null;
  const asset = repo.createAsset(db, {
    episodeId,
    stageId,
    kind: input.kind,
    relativePath: input.relativePath,
    mimeType,
    sizeBytes,
  });
  history.addEvent(db, {
    episodeId,
    projectId: episode.projectId,
    eventType: "asset.imported",
    message: `Asset imported: ${input.kind} ${input.relativePath}`,
    metadata: { assetId: asset.id, stageId },
  });
  return asset;
}

export function deleteAsset(db: Db, episodeId: string, assetId: string) {
  requireEpisode(db, episodeId);
  const asset = repo.getAsset(db, assetId);
  if (!asset || asset.episodeId !== episodeId) throw notFound("Asset not found");
  repo.deleteAsset(db, assetId);
  const episode = requireEpisode(db, episodeId);
  history.addEvent(db, {
    episodeId,
    projectId: episode.projectId,
    eventType: "asset.deleted",
    message: `Asset removed: ${asset.kind} ${asset.relativePath}`,
    metadata: { assetId, stageId: asset.stageId },
  });
  return { removed: true };
}
