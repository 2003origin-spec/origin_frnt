import { Pool } from "pg";

import { createPostgresPoolConfig } from "@/server/postgres-config";

declare global {
  var __originUserPool: Pool | undefined;
  var __originUserPoolConnectionString: string | undefined;
  var __originUserReplicaPool: Pool | undefined;
  var __originUserReplicaConnectionString: string | undefined;
}

function getConnectionString(): string | null {
  return process.env.USER_DATABASE_URL ?? null;
}

function getReplicaConnectionString(): string | null {
  // Opt-in read-replica for read-heavy paths (contest paper origin fill,
  // live-contest scan, Phase-6 leaderboard reads). Unset ⇒ use the primary.
  return process.env.USER_REPLICA_DATABASE_URL?.trim() || null;
}

export function isUserPostgresConfigured(): boolean {
  return Boolean(getConnectionString());
}

export function getUserPostgresPool(): Pool | null {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

  const poolConfig = createPostgresPoolConfig(connectionString, 25);

  if (!globalThis.__originUserPool || globalThis.__originUserPoolConnectionString !== poolConfig.connectionString) {
    void globalThis.__originUserPool?.end().catch(() => undefined);
    globalThis.__originUserPool = new Pool(poolConfig);
    globalThis.__originUserPoolConnectionString = poolConfig.connectionString;
  }

  return globalThis.__originUserPool;
}

/**
 * Read-replica pool for read-only queries, or the primary pool when
 * USER_REPLICA_DATABASE_URL is unset. Safe to use for reads only (a replica may
 * lag the primary). Callers that need read-your-writes must use
 * getUserPostgresPool().
 */
export function getUserPostgresReplicaPool(): Pool | null {
  const replica = getReplicaConnectionString();
  if (!replica) return getUserPostgresPool();

  const poolConfig = createPostgresPoolConfig(replica, 25);
  if (
    !globalThis.__originUserReplicaPool ||
    globalThis.__originUserReplicaConnectionString !== poolConfig.connectionString
  ) {
    void globalThis.__originUserReplicaPool?.end().catch(() => undefined);
    globalThis.__originUserReplicaPool = new Pool(poolConfig);
    globalThis.__originUserReplicaConnectionString = poolConfig.connectionString;
  }
  return globalThis.__originUserReplicaPool;
}
