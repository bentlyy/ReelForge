import { loadEnv } from "./env.js";
import { openDb } from "./db/connection.js";
import { migrate } from "./db/migrate.js";
import { createApp } from "./app.js";
import { createQueueWorker } from "./worker/startWorker.js";

const env = loadEnv();
const db = openDb(env);
migrate(db);
const { app, logger } = createApp(env, db);

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(
    { host: env.API_HOST, port: env.API_PORT, db: env.dbPathResolved },
    "Reel Engine API listening",
  );
});

if (env.WORKER_ENABLED) {
  const worker = createQueueWorker(env, db, logger);
  worker.start();
  logger.info(
    { concurrency: env.WORKER_CONCURRENCY, pollMs: env.WORKER_POLL_MS },
    "queue worker started",
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    await worker.stop();
    server.close(() => {
      db.close();
      process.exit(0);
    });
    const timer = setTimeout(() => process.exit(1), 5000);
    timer.unref?.();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
} else {
  logger.info("queue worker disabled (set WORKER_ENABLED=true)");
}
