import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach } from "vitest";
import type { Express } from "express";
import type { Db } from "../db/connection.js";
import { openDb } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import { createApp } from "../app.js";
import { loadEnv } from "../env.js";
import { _resetRateLimitForTests } from "../middleware/rateLimit.js";

export let app: Express;
export let db: Db;
export let storageRoot: string;
let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelengine-"));
  const env = loadEnv({
    NODE_ENV: "test",
    DB_PATH: path.join(tmpDir, "test.db"),
    STORAGE_ROOT: path.join(tmpDir, "storage"),
    LOG_LEVEL: "silent",
  });
  storageRoot = env.storageRoot;
  db = openDb(env);
  migrate(db);
  app = createApp(env, db).app;
});

beforeEach(() => {
  _resetRateLimitForTests();
  db.exec(`DELETE FROM activity_events; DELETE FROM assets; DELETE FROM approvals; DELETE FROM job_queue; DELETE FROM pipeline_jobs; DELETE FROM pipeline_stages; DELETE FROM episodes; DELETE FROM provider_configs; DELETE FROM projects;`);
});

afterAll(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
