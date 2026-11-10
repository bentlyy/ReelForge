import type { Logger } from "pino";
import type { Db } from "../db/connection.js";
import type { Env } from "../env.js";
import { createDefaultRegistry } from "../providers/registry.js";
import { getProviderConfig } from "../repositories/providerConfigs.js";
import { QueueWorker, type QueueWorkerOptions } from "./queueWorker.js";

export function createQueueWorker(
  env: Env,
  db: Db,
  logger: Logger,
  overrides: QueueWorkerOptions = {},
): QueueWorker {
  const registry = createDefaultRegistry({
    configSource: {
      getConfig: (projectId, stageType) => {
        const cfg = getProviderConfig(db, projectId, stageType);
        return cfg ? { providerKind: cfg.providerKind, enabled: cfg.enabled } : null;
      },
    },
    onFallback: ({ stageType, requested }) =>
      logger.warn({ stageType, requested }, "provider not implemented; falling back to stub"),
  });

  return new QueueWorker(
    { db, registry, logger, storageRoot: env.storageRoot },
    {
      pollIntervalMs: env.WORKER_POLL_MS,
      leaseMs: env.WORKER_LEASE_MS,
      concurrency: env.WORKER_CONCURRENCY,
      ...overrides,
    },
  );
}
