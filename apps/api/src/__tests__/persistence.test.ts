import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../db/connection.js";
import { migrate } from "../db/migrate.js";
import * as projects from "../repositories/projects.js";

describe("sqlite persistence", () => {
  it("persists after reopen", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-persist-"));
    const dbPath = path.join(dir, "p.db");
    const db1 = openDb({ dbPathResolved: dbPath } as any);
    migrate(db1);
    const p = projects.createProject(db1, { name: "X", description: "", platform: "generic_vertical" });
    db1.close();
    const db2 = openDb({ dbPathResolved: dbPath } as any);
    migrate(db2);
    const got = projects.getProject(db2, p.id);
    expect(got?.name).toBe("X");
    db2.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
