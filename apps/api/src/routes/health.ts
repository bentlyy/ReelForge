import { Router } from "express";
export const healthRouter = Router();
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "reel-engine-api", time: new Date().toISOString() });
});
