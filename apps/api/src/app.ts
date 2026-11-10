import express from "express";
import { pinoHttp } from "pino-http";
import type { Db } from "./db/connection.js";
import type { Env } from "./env.js";
import { createLogger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { healthRouter } from "./routes/health.js";
import { projectsRouter } from "./routes/projects.js";
import { episodesRouter } from "./routes/episodes.js";
import { stagesRouter } from "./routes/stages.js";
import { approvalsRouter } from "./routes/approvals.js";
import { historyRouter } from "./routes/history.js";
import { jobsRouter } from "./routes/jobs.js";

export function createApp(env: Env, db: Db) {
  const logger = createLogger(env);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(express.json({ limit: "256kb" }));
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  app.use("/api", healthRouter);
  app.use("/api/projects", projectsRouter(db));
  app.use("/api/episodes", episodesRouter(db));
  app.use("/api/stages", stagesRouter(db));
  app.use("/api/approvals", approvalsRouter(db));
  app.use("/api/history", historyRouter(db));
  app.use("/api/jobs", jobsRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return { app, logger };
}
