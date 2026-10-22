/**
 * Host guard for scripts that delete or truncate data (`--replace` imports).
 *
 * Same idea as dev-bootstrap-db.mjs ("refuses to run against anything but
 * localhost"), extracted so it can be shared and unit tested. These scripts are
 * documented as local-setup steps but read whatever `.env.local` or the shell
 * holds, so a prod URL there turns a setup step into a prod wipe.
 *
 * A non-local host is allowed only when BOTH are present:
 *   - the `--i-know-this-is-prod` flag, and
 *   - CONFIRM_DESTRUCTIVE_DB_HOST=<the exact target hostname> in the environment.
 * The env value has to name the host, so a flag pasted from a runbook cannot
 * confirm a different database than the one actually configured.
 */

export const PROD_OVERRIDE_FLAG = "--i-know-this-is-prod";
export const CONFIRM_HOST_ENV = "CONFIRM_DESTRUCTIVE_DB_HOST";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** @param {string | null | undefined} hostname */
export function isLocalDatabaseHost(hostname) {
  if (!hostname) return false;
  const host = hostname.replace(/^\[/u, "").replace(/\]$/u, "").toLowerCase();
  if (LOCAL_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  // The whole 127.0.0.0/8 block is loopback.
  return /^127(?:\.\d{1,3}){3}$/u.test(host);
}

/** @param {string | null | undefined} connectionString */
function parseDatabaseUrl(connectionString) {
  if (!connectionString) return null;
  try {
    return new URL(connectionString.replace(/^postgresql\+asyncpg:/u, "postgresql:"));
  } catch {
    return null;
  }
}

/**
 * Every `host=` query value of a Postgres URL, lower-cased. pg-connection-string
 * connects to the LAST one while a naive read takes the first, so callers must
 * refuse when there is more than one (round-3 R3-12).
 *
 * @param {string | null | undefined} connectionString
 * @returns {string[]}
 */
export function queryHostsOf(connectionString) {
  const url = parseDatabaseUrl(connectionString);
  return url ? url.searchParams.getAll("host").map((host) => host.trim().toLowerCase()) : [];
}

/**
 * Hostname a Postgres URL connects to, lower-cased and without IPv6 brackets.
 * A socket path (`?host=/var/run/postgresql`) is returned as that path.
 * Returns null when the URL cannot be parsed, names no host, or is ambiguous
 * (several `host=` values, or an empty one), so callers fail closed.
 *
 * @param {string | null | undefined} connectionString
 * @returns {string | null}
 */
export function databaseHostOf(connectionString) {
  const url = parseDatabaseUrl(connectionString);
  if (!url) return null;
  const queryHosts = queryHostsOf(connectionString);
  if (queryHosts.length > 1) return null;
  if (queryHosts.length === 1) return queryHosts[0] || null;
  const host = url.hostname.replace(/^\[/u, "").replace(/\]$/u, "").toLowerCase();
  return host || null;
}

/**
 * @param {{ connectionString: string | null | undefined, argv: readonly string[], env: Record<string, string | undefined>, action: string }} input
 * @returns {{ allowed: boolean, host: string | null, local: boolean, reason: string }}
 */
export function checkDestructiveTarget({ connectionString, argv, env, action }) {
  const queryHosts = queryHostsOf(connectionString);
  if (queryHosts.length > 1) {
    // Never allowed, not even with the override: one confirmed host cannot vouch for several.
    return {
      allowed: false,
      host: null,
      local: false,
      reason: `${action}: the database URL names ${queryHosts.length} hosts (host=${queryHosts.join(", host=")}), so refusing.`,
    };
  }
  const host = databaseHostOf(connectionString);
  if (!host) {
    return {
      allowed: false,
      host,
      local: false,
      reason: `${action}: cannot tell which host the database URL points at, so refusing.`,
    };
  }
  const local = host.startsWith("/") || isLocalDatabaseHost(host);
  if (local) {
    return { allowed: true, host, local, reason: `${action}: local database ${host}.` };
  }
  const flag = argv.includes(PROD_OVERRIDE_FLAG);
  const confirmed = (env[CONFIRM_HOST_ENV] ?? "").trim().toLowerCase() === host;
  if (flag && confirmed) {
    return { allowed: true, host, local, reason: `${action}: non-local host ${host} explicitly confirmed.` };
  }
  return {
    allowed: false,
    host,
    local,
    reason:
      `${action} REFUSED against non-local host ${host}. This is a destructive step meant for a local ` +
      `database. If you really mean this host, pass ${PROD_OVERRIDE_FLAG} AND set ${CONFIRM_HOST_ENV}=${host}.` +
      (flag && !confirmed ? ` (${PROD_OVERRIDE_FLAG} was given but ${CONFIRM_HOST_ENV} does not match.)` : ""),
  };
}

/** argv without the guard's own flag, for parsers that reject unknown flags. */
export function withoutGuardFlags(argv) {
  return argv.filter((arg) => arg !== PROD_OVERRIDE_FLAG);
}
