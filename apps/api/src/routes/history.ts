import { Router } from "express";
import type { Db } from "../db/connection.js";
import { listHistory } from "../repositories/history.js";

export function historyRouter(db: Db) {
  const r = Router();
  r.get("/", (req, res) => {
    const episodeId = typeof req.query.episodeId === "string" ? req.query.episodeId : undefined;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    res.json({ data: listHistory(db, episodeId, projectId) });
  });
  return r;
}
