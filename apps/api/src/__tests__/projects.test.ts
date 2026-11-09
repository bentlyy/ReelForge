import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./setup.js";

describe("projects", () => {
  it("creates and lists projects", async () => {
    const c = await request(app).post("/api/projects").send({ name: "Canal A", description: "desc", platform: "youtube_shorts" });
    expect(c.status).toBe(201);
    expect(c.body.data.name).toBe("Canal A");
    const list = await request(app).get("/api/projects");
    expect(list.body.data).toHaveLength(1);
  });
  it("edits project", async () => {
    const c = await request(app).post("/api/projects").send({ name: "A" });
    const id = c.body.data.id;
    const u = await request(app).patch(`/api/projects/${id}`).send({ name: "B" });
    expect(u.status).toBe(200);
    expect(u.body.data.name).toBe("B");
  });
});
