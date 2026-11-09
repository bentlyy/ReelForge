import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./setup.js";

async function mkProject() {
  return (await request(app).post("/api/projects").send({ name: "P" })).body.data.id as string;
}

describe("episodes", () => {
  it("creates episode with stages", async () => {
    const projectId = await mkProject();
    const c = await request(app).post("/api/episodes").send({ projectId, title: "Ep1", synopsis: "s" });
    expect(c.status).toBe(201);
    expect(c.body.data.stages).toHaveLength(7);
  });
  it("edits episode", async () => {
    const projectId = await mkProject();
    const ep = (await request(app).post("/api/episodes").send({ projectId, title: "Ep1" })).body.data;
    const u = await request(app).patch(`/api/episodes/${ep.id}`).send({ title: "Ep2" });
    expect(u.body.data.title).toBe("Ep2");
  });
});
