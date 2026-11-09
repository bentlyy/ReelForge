import { loadEnv } from "./env.js";
import { openDb } from "./db/connection.js";
import { migrate } from "./db/migrate.js";
import { createApp } from "./app.js";

const env = loadEnv();
const db = openDb(env);
migrate(db);
const { app, logger } = createApp(env, db);

app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info({ host: env.API_HOST, port: env.API_PORT, db: env.dbPathResolved }, "Reel Engine API listening");
});
