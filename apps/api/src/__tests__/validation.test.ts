import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./setup.js";

describe("validation and errors", () => {
  it("validates project body", async () => {
    const r = await request(app).post("/api/projects").send({ name: "" });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("BAD_REQUEST");
  });
  it("404 on missing project", async () => {
    const r = await request(app).get("/api/projects/prj_missing");
    expect(r.status).toBe(404);
  });
  it("health ok", async () => {
    const r = await request(app).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ok");
  });
});
