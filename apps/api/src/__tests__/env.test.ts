import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyEnvFile } from "../lib/dotenv.js";
import { loadEnv, REPO_ROOT } from "../env.js";

const KEY = "REEL_TEST_DOTENV";

describe("env", () => {
  afterEach(() => {
    delete process.env[KEY];
  });

  it("loads .env values only when the process env does not define them", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-env-"));
    const file = path.join(dir, ".env");
    fs.writeFileSync(file, `${KEY}=from_file\n`);
    try {
      process.env[KEY] = "from_process";
      expect(applyEnvFile(file)).toBe(true);
      expect(process.env[KEY]).toBe("from_process");

      delete process.env[KEY];
      expect(applyEnvFile(file)).toBe(true);
      expect(process.env[KEY]).toBe("from_file");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves relative DB and storage paths against the repository root", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      DB_PATH: "storage/test-rel.db",
      STORAGE_ROOT: "storage/assets",
    });
    expect(env.dbPathResolved).toBe(path.resolve(REPO_ROOT, "storage/test-rel.db"));
    expect(env.storageRoot).toBe(path.resolve(REPO_ROOT, "storage/assets"));
  });

  it("accepts strict boolean worker flags", () => {
    for (const value of ["true", "1", "yes", "on"]) {
      expect(loadEnv({ NODE_ENV: "test", WORKER_ENABLED: value }).WORKER_ENABLED).toBe(true);
    }
    for (const value of ["false", "0", "no", "off", ""]) {
      expect(loadEnv({ NODE_ENV: "test", WORKER_ENABLED: value }).WORKER_ENABLED).toBe(false);
    }
    expect(() => loadEnv({ NODE_ENV: "test", WORKER_ENABLED: "maybe" })).toThrow();
  });
});
