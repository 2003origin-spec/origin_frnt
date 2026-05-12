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
  };

  if (shouldDisableSsl(normalizedConnectionString)) {
    config.ssl = false;
  } else if (!hasExplicitSslMode(normalizedConnectionString)) {
    config.ssl = true;
  }

  return config;
}
