import { Pool } from "pg";

import { createPostgresPoolConfig } from "@/server/postgres-config";

declare global {
  var __originOgcodePool: Pool | undefined;
}

function getConnectionString(): string | null {
  return (
    process.env.OGCODE_DATABASE_URL ??
    process.env.OGCODE_POSTGRES_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

export function isOgcodePostgresConfigured(): boolean {
  return Boolean(getConnectionString());
}

export function getOgcodePostgresPool(): Pool | null {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }

  if (!globalThis.__originOgcodePool) {
    globalThis.__originOgcodePool = new Pool(createPostgresPoolConfig(connectionString, 5));
  }

  return globalThis.__originOgcodePool;
}
