import type { PoolConfig } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type OriginPostgresPoolConfig = PoolConfig & { connectionString: string };

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[/u, "").replace(/\]$/u, "").toLowerCase();
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTS.has(normalizeHostname(hostname));
}

function connectionUrl(connectionString: string): URL | null {
  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
}

export function normalizePostgresConnectionString(connectionString: string): string {
  const url = connectionUrl(connectionString);
  if (!url) {
    return connectionString;
  }

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  if (isLocalHostname(url.hostname) || sslMode === "disable") {
    return connectionString;
  }

  if (sslMode !== "verify-full") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

function shouldDisableSsl(connectionString: string): boolean {
  const url = connectionUrl(connectionString);
  if (url) {
    return isLocalHostname(url.hostname) || url.searchParams.get("sslmode")?.toLowerCase() === "disable";
  }
  return /\bsslmode\s*=\s*disable\b/iu.test(connectionString) || /\b(localhost|127\.0\.0\.1|::1)\b/iu.test(connectionString);
}

function hasExplicitSslMode(connectionString: string): boolean {
  const url = connectionUrl(connectionString);
  if (url) {
    return Boolean(url.searchParams.get("sslmode"));
  }
  return /\bsslmode\s*=/iu.test(connectionString);
}

export function createPostgresPoolConfig(connectionString: string, max: number): OriginPostgresPoolConfig {
  const normalizedConnectionString = normalizePostgresConnectionString(connectionString);
  const config: OriginPostgresPoolConfig = {
    connectionString: normalizedConnectionString,
    max,
    // Serverless + Neon connection pooler (PgBouncer, transaction mode) hardening.
    // These make the switch to the -pooler endpoint seamless and prevent the two
    // classic failure modes under load:
    //   • idleTimeoutMillis  — release idle client connections quickly so they
    //     don't hold PgBouncer slots that other Vercel instances need.
    //   • connectionTimeoutMillis — fail fast instead of hanging when the pool
    //     or the pooler is momentarily saturated.
    //   • keepAlive — reduce reconnect churn on long-lived instances.
    //   • allowExitOnIdle — don't keep a frozen serverless instance's event loop
    //     alive on idle connections.
    // The app is transaction-mode safe (no LISTEN/NOTIFY, session advisory locks,
    // named prepared statements or session-scoped SET). Schema ensures use
    // transaction-scoped `pg_advisory_xact_lock`, which PgBouncer releases on
    // COMMIT/ROLLBACK.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    allowExitOnIdle: true,
  };

  if (shouldDisableSsl(normalizedConnectionString)) {
    config.ssl = false;
  } else if (!hasExplicitSslMode(normalizedConnectionString)) {
    config.ssl = true;
  }

  return config;
}
