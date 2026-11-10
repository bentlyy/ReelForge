import { describe, it, expect } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { app, storageRoot } from "./setup.js";

async function mkEpisode(title = "E") {
  const projectId = (await request(app).post("/api/projects").send({ name: "P" })).body.data.id;
  const episode = (
    await request(app).post("/api/episodes").send({ projectId, title })
  ).body.data;
  return { projectId, episodeId: episode.id as string, stages: episode.stages };
}

function writeFile(episodeId: string, relativePath: string, content = "hola") {
  const full = path.join(storageRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return relativePath;
}

function post(episodeId: string, body: Record<string, unknown>) {
  return request(app).post(`/api/episodes/${episodeId}/assets`).send(body);
}

describe("assets API", () => {
  it("imports a stored file, infers mime/size and lists it", async () => {
    const { episodeId, stages } = await mkEpisode();
    const relativePath = writeFile(episodeId, `episodes/${episodeId}/script/script.txt`);

    const res = await post(episodeId, {
      kind: "other",
      relativePath,
      stageId: stages[0].id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      episodeId,
      stageId: stages[0].id,
      kind: "other",
      relativePath,
      mimeType: "text/plain",
      sizeBytes: 4,
    });

    const list = await request(app).get(`/api/episodes/${episodeId}/assets`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(res.body.data.id);

    const history = await request(app).get(`/api/history?episodeId=${episodeId}`);
    expect(history.body.data.map((e: any) => e.eventType)).toContain("asset.imported");
  });

  it("allows episode-level assets and explicit mime types", async () => {
    const { episodeId } = await mkEpisode();
    const relativePath = writeFile(episodeId, `episodes/${episodeId}/image/cover.png`, "png");
    const res = await post(episodeId, {
      kind: "image",
      relativePath,
      mimeType: "image/custom",
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      stageId: null,
      mimeType: "image/custom",
      sizeBytes: 3,
    });
  });

  it("deletes an asset and rejects mismatched or missing ids", async () => {
    const { episodeId, stages } = await mkEpisode();
    const relativePath = writeFile(episodeId, `episodes/${episodeId}/script/a.txt`);
    const asset = (await post(episodeId, { kind: "other", relativePath, stageId: stages[0].id }))
      .body.data;

    const other = await mkEpisode("Other");
    const wrong = await request(app).delete(
      `/api/episodes/${other.episodeId}/assets/${asset.id}`,
    );
    expect(wrong.status).toBe(404);

    const del = await request(app).delete(`/api/episodes/${episodeId}/assets/${asset.id}`);
    expect(del.status).toBe(200);
    expect(del.body.data.removed).toBe(true);
    expect((await request(app).get(`/api/episodes/${episodeId}/assets`)).body.data).toEqual([]);

    const again = await request(app).delete(`/api/episodes/${episodeId}/assets/${asset.id}`);
    expect(again.status).toBe(404);
  });

  it("rejects invalid paths, missing files, foreign stages and unknown kinds", async () => {
    const { episodeId, stages } = await mkEpisode();
    const other = await mkEpisode("Other");

    expect(
      (
        await post(episodeId, {
          kind: "other",
          relativePath: `episodes/${episodeId}/../secret.txt`,
        })
      ).status,
    ).toBe(400);
    expect((await post(episodeId, { kind: "other", relativePath: "other/file.txt" })).status).toBe(
      400,
    );
    expect(
      (
        await post(episodeId, {
          kind: "other",
          relativePath: `episodes/${episodeId}/script/missing.txt`,
        })
      ).status,
    ).toBe(400);

    const relativePath = writeFile(episodeId, `episodes/${episodeId}/script/a.txt`);
    expect(
      (await post(episodeId, { kind: "other", relativePath, stageId: other.stages[0].id })).status,
    ).toBe(400);
    expect(
      (await post(episodeId, { kind: "pdf", relativePath, stageId: stages[0].id })).status,
    ).toBe(400);
    expect(
      (await post(episodeId, { kind: "other", relativePath: relativePath.replace(/\//g, "\\") }))
        .status,
    ).toBe(400);

    const missing = "ep_missing";
    expect((await post(missing, { kind: "other", relativePath })).status).toBe(404);
    expect((await request(app).get(`/api/episodes/${missing}/assets`)).status).toBe(404);
    expect(
      (await request(app).delete(`/api/episodes/${missing}/assets/ast_missing`)).status,
    ).toBe(404);
  });
});
