import { describe, it, expect } from "vitest";
import path from "node:path";
import { db } from "./setup.js";
import { migrate, MIGRATIONS_DIR } from "../db/migrate.js";

describe("migrations", () => {
  it("resolves the package-level migrations directory for src and dist", () => {
    expect(path.basename(MIGRATIONS_DIR)).toBe("migrations");
    expect(path.basename(path.dirname(MIGRATIONS_DIR))).toBe("api");
  });

  it("applies every migration exactly once and creates Phase 2 tables", () => {
    migrate(db);
    migrate(db);
    const ids = db.prepare("SELECT id FROM schema_migrations ORDER BY id").pluck().all();
    expect(ids).toContain("001_init.sql");
    expect(ids).toContain("002_pipeline_queue.sql");

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .pluck()
      .all();
    expect(tables).toEqual(
      expect.arrayContaining(["projects", "pipeline_stages", "provider_configs", "job_queue"]),
    );
  });
});
