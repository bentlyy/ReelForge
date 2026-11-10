import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { applyEnvFile } from "./lib/dotenv.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(moduleDir, "..");
export const REPO_ROOT = path.resolve(moduleDir, "../../..");

const envBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off", ""].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DB_PATH: z.string().default("storage/reelengine.db"),
  STORAGE_ROOT: z.string().default("storage"),
  WORKER_ENABLED: envBoolean.default(false),
  WORKER_POLL_MS: z.coerce.number().int().min(50).max(3_600_000).default(5_000),
  WORKER_LEASE_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
});

export type Env = z.infer<typeof envSchema> & { dbPathResolved: string; storageRoot: string };

function resolveFromRepo(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

export function loadEnv(overrides: Partial<Record<string, string>> = {}): Env {
  const nodeEnv = overrides.NODE_ENV ?? process.env.NODE_ENV;
  if (nodeEnv !== "test") {
    applyEnvFile(path.join(APP_ROOT, ".env"));
    applyEnvFile(path.join(REPO_ROOT, ".env"));
  }

  const parsed = envSchema.parse({ ...process.env, ...overrides });
  const dbPathResolved = resolveFromRepo(parsed.DB_PATH);
  const storageRoot = resolveFromRepo(parsed.STORAGE_ROOT);
  fs.mkdirSync(path.dirname(dbPathResolved), { recursive: true });
  return { ...parsed, dbPathResolved, storageRoot };
}
