import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./setup.js";

async function mkEpisode() {
  const p = (await request(app).post("/api/projects").send({ name: "P" })).body.data.id;
  return (await request(app).post("/api/episodes").send({ projectId: p, title: "E" })).body.data;
}

describe("pipeline transitions and approvals", () => {
  it("runs stub to WAITING_APPROVAL then approves to COMPLETED", async () => {
    const ep = await mkEpisode();
    const stageId = ep.stages[0].id;
    const run = await request(app).post(`/api/stages/${stageId}/run-stub`).send();
    expect(run.status).toBe(200);
    expect(run.body.data.status).toBe("WAITING_APPROVAL");
    const apr = await request(app).post(`/api/stages/${stageId}/actions`).send({ action: "approve", note: "ok" });
    expect(apr.body.data.status).toBe("COMPLETED");
  });
  it("rejects then allows retry", async () => {
    const ep = await mkEpisode();
    const stageId = ep.stages[0].id;
    await request(app).post(`/api/stages/${stageId}/run-stub`).send();
    const rej = await request(app).post(`/api/stages/${stageId}/actions`).send({ action: "reject", note: "no" });
    expect(rej.body.data.status).toBe("FAILED");
    const retry = await request(app).post(`/api/stages/${stageId}/actions`).send({ action: "retry" });
    expect(retry.body.data.status).toBe("PENDING");
  });
  it("rejects invalid transition", async () => {
    const ep = await mkEpisode();
    const stageId = ep.stages[0].id; // PENDING
    const bad = await request(app).post(`/api/stages/${stageId}/actions`).send({ action: "approve" });
    expect(bad.status).toBe(409);
  });
});
