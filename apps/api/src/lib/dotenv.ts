import fs from "node:fs";
import { parseEnv } from "node:util";

export function applyEnvFile(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  const values = parseEnv(fs.readFileSync(file, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}
