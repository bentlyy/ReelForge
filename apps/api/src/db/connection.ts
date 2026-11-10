import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Env } from "../env.js";

export type Db = Database.Database;

export function openDb(env: Pick<Env, "dbPathResolved">): Db {
  fs.mkdirSync(path.dirname(env.dbPathResolved), { recursive: true });
  const db = new Database(env.dbPathResolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  return db;
}
