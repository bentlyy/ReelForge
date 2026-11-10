import { Router } from "express";
import type { Db } from "../db/connection.js";
import { listApprovals } from "../repositories/approvals.js";
import { badRequest } from "../lib/errors.js";

export function approvalsRouter(db: Db) {
  const r = Router();
  r.get("/stage/:stageId", (req, res, next) => {
    const id = req.params.stageId;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return next(badRequest("Invalid id"));
    res.json({ data: listApprovals(db, id) });
  });
  return r;
}
