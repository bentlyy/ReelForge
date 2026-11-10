import fs from "node:fs";
import path from "node:path";
import { badRequest } from "./errors.js";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const SAFE_STAGE = /^[A-Z_]{1,60}$/;
const SAFE_FILENAME = /^[a-zA-Z0-9._-]{1,200}$/;

export function assertSafeId(value: string, label = "id"): string {
  if (!SAFE_ID.test(value)) throw badRequest(`Invalid ${label}`);
  return value;
}

export function assertSafeFilename(name: string): string {
  if (!SAFE_FILENAME.test(name) || name === "." || name === "..") {
    throw badRequest("Invalid filename");
  }
  return name;
}

export class StorageService {
  private readonly root: string;

  constructor(storageRoot: string) {
    this.root = path.resolve(storageRoot);
  }

  get storageRoot(): string {
    return this.root;
  }

  resolveEpisodeDir(episodeId: string, stageType: string): string {
    assertSafeId(episodeId, "episodeId");
    if (!SAFE_STAGE.test(stageType)) throw badRequest("Invalid stage type");
    const dir = path.resolve(this.root, "episodes", episodeId, stageType.toLowerCase());
    if (!dir.startsWith(this.root + path.sep)) throw badRequest("Path escapes storage root");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  resolveEpisodeFile(episodeId: string, stageType: string, filename: string): string {
    const dir = this.resolveEpisodeDir(episodeId, stageType);
    const safeName = assertSafeFilename(filename);
    const full = path.resolve(dir, safeName);
    if (!full.startsWith(dir + path.sep)) throw badRequest("Path escapes storage root");
    return full;
  }
}
