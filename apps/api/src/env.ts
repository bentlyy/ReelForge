import { z } from "zod";
import path from "node:path";
import fs from "node:fs";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DB_PATH: z.string().default("../../storage/reelengine.db"),
});

export type Env = z.infer<typeof envSchema> & { dbPathResolved: string; storageRoot: string };

export function loadEnv(overrides: Partial<Record<string, string>> = {}): Env {
  const parsed = envSchema.parse({ ...process.env, ...overrides });
  const cwd = process.cwd();
  const dbPathResolved = path.isAbsolute(parsed.DB_PATH)
    ? parsed.DB_PATH
    : path.resolve(cwd, parsed.DB_PATH);
  const storageRoot = path.resolve(path.dirname(dbPathResolved));
  fs.mkdirSync(path.dirname(dbPathResolved), { recursive: true });
  return { ...parsed, dbPathResolved, storageRoot };
}
