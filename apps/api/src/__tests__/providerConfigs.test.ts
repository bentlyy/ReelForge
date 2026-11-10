import { describe, it, expect } from "vitest";
import request from "supertest";
import { PIPELINE_STAGE_TYPES } from "@reel-engine/shared";
import { app } from "./setup.js";

const base = { providerKind: "manual", enabled: true, timeoutMs: 5000, maxAttempts: 2 };

function put(stageType: string, body: Record<string, unknown>, projectId?: string) {
  const qs = projectId ? `?projectId=${projectId}` : "";
  return request(app).put(`/api/provider-configs/${stageType}${qs}`).send(body);
}

function get(projectId?: string) {
  const qs = projectId ? `?projectId=${projectId}` : "";
  return request(app).get(`/api/provider-configs${qs}`);
}

async function mkProject(name = "P") {
  return (await request(app).post("/api/projects").send({ name })).body.data;
}

describe("provider configs API", () => {
  it("returns stub defaults for every stage in global scope", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const view = res.body.data;
    expect(view.projectId).toBeNull();
    expect(view.configs).toEqual([]);
    expect(view.effective.map((c: { stageType: string }) => c.stageType)).toEqual([
      ...PIPELINE_STAGE_TYPES,
    ]);
    for (const cfg of view.effective) {
      expect(cfg).toMatchObject({
        providerKind: "stub",
        enabled: true,
        timeoutMs: 120_000,
        maxAttempts: 3,
      });
    }
  });

  it("upserts a global config that projects inherit", async () => {
    const res = await put("SCRIPT", { ...base, enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      stageType: "SCRIPT",
      providerKind: "manual",
      enabled: false,
      timeoutMs: 5000,
      maxAttempts: 2,
    });

    const project = await mkProject();
    const globalView = (await get()).body.data;
    expect(globalView.configs).toHaveLength(1);
    expect(globalView.effective.find((c: any) => c.stageType === "SCRIPT")).toMatchObject({
      providerKind: "manual",
      enabled: false,
      timeoutMs: 5000,
    });

    const projectView = (await get(project.id)).body.data;
    expect(projectView.projectId).toBe(project.id);
    expect(projectView.configs).toEqual([]);
    expect(projectView.effective.find((c: any) => c.stageType === "SCRIPT")).toMatchObject({
      providerKind: "manual",
      enabled: false,
      timeoutMs: 5000,
    });
  });

  it("project overrides win over global and can be reset", async () => {
    const project = await mkProject();
    await put("SCRIPT", base);
    const overridden = await put(
      "SCRIPT",
      { ...base, providerKind: "external_api", timeoutMs: 7000, maxAttempts: 1 },
      project.id,
    );
    expect(overridden.status).toBe(200);

    const projectView = (await get(project.id)).body.data;
    expect(projectView.configs).toHaveLength(1);
    expect(projectView.effective.find((c: any) => c.stageType === "SCRIPT")).toMatchObject({
      providerKind: "external_api",
      timeoutMs: 7000,
      maxAttempts: 1,
    });
    const globalView = (await get()).body.data;
    expect(globalView.effective.find((c: any) => c.stageType === "SCRIPT")).toMatchObject({
      providerKind: "manual",
    });

    const del = await request(app).delete(
      `/api/provider-configs/SCRIPT?projectId=${project.id}`,
    );
    expect(del.status).toBe(200);
    expect(del.body.data.removed).toBe(true);
    expect(
      (await get(project.id)).body.data.effective.find((c: any) => c.stageType === "SCRIPT"),
    ).toMatchObject({ providerKind: "manual" });

    const again = await request(app).delete(
      `/api/provider-configs/SCRIPT?projectId=${project.id}`,
    );
    expect(again.body.data.removed).toBe(false);

    await request(app).delete("/api/provider-configs/SCRIPT");
    expect(
      (await get()).body.data.effective.find((c: any) => c.stageType === "SCRIPT"),
    ).toMatchObject({ providerKind: "stub", timeoutMs: 120_000, maxAttempts: 3 });
  });

  it("rejects secrets, invalid fields, bad scopes and unknown stages", async () => {
    expect((await put("SCRIPT", { ...base, apiKey: "sk-123" })).status).toBe(400);
    expect((await put("SCRIPT", { ...base, configRef: "lowercase" })).status).toBe(400);
    expect((await put("SCRIPT", { ...base, timeoutMs: 10 })).status).toBe(400);
    expect((await put("SCRIPT", { ...base, maxAttempts: 99 })).status).toBe(400);
    expect((await put("NOPE", base)).status).toBe(400);
    expect((await get("../etc")).status).toBe(400);

    const missing = "prj_missing";
    expect((await get(missing)).status).toBe(404);
    expect((await put("SCRIPT", base, missing)).status).toBe(404);
    expect(
      (await request(app).delete(`/api/provider-configs/SCRIPT?projectId=${missing}`)).status,
    ).toBe(404);
  });
});
