/**
 * Check for the env vars a hosted production deploy cannot run without
 * (build time, boot log and /api/health). Without it a missing secret only
 * shows up as per-request 500s
 * ("CBT_PARTICIPANT_TOKEN_SECRET must be set", "DRAIN_SECRET is not
 * configured", …) discovered by users instead of by the deploy.
 *
 * Pure on purpose (env and flags are passed in) so it is unit-testable and safe
 * to import from `src/instrumentation.ts`. Keep `.env.example` in step with it.
 */

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** The feature flags that pull in extra required secrets. */
export interface RequiredEnvFlags {
  cbtModule: boolean;
  originNow: boolean;
  contest: boolean;
}

interface Requirement {
  /** Any one of these names satisfies the requirement (first is canonical). */
  names: readonly string[];
  /** Why it is required when not always (shown in the error). */
  reason?: string;
  minLength?: number;
  when?: (flags: RequiredEnvFlags) => boolean;
}

const REQUIREMENTS: readonly Requirement[] = [
  // Auth: access/refresh JWTs cannot be issued or verified without it.
  { names: ["AUTH_JWT_SECRET_CURRENT"] },
  // Databases. The OGCode pool falls back through the same chain as src/server/postgres.ts.
  { names: ["USER_DATABASE_URL"] },
  { names: ["OGCODE_DATABASE_URL", "OGCODE_POSTGRES_URL", "POSTGRES_URL", "DATABASE_URL"] },
  // Internal drains/cron routes reject every caller without it.
  { names: ["INTERNAL_CRON_TOKEN"] },
  // Rate limiting, rooms/presence and kill-switch state live in Upstash.
  { names: ["UPSTASH_REDIS_REST_URL"] },
  { names: ["UPSTASH_REDIS_REST_TOKEN"] },
  // Student CBT join/report tokens (src/lib/cbt/participant-token.ts throws below 32 chars).
  {
    names: ["CBT_PARTICIPANT_TOKEN_SECRET"],
    reason: "cbtModule on",
    minLength: 32,
    when: (f) => f.cbtModule,
  },
  // Origin NOW: helper KYC is encrypted at rest; private uploads go to the private bucket.
  { names: ["NOW_KYC_ENCRYPTION_KEY"], reason: "originNow on", when: (f) => f.originNow },
  { names: ["R2_PRIVATE_BUCKET"], reason: "originNow on", when: (f) => f.originNow },
  // Contest: the draft/grading worker, and Vercel Cron's own bearer for the contest crons.
  { names: ["CONTEST_SERVICE_URL"], reason: "contest on", when: (f) => f.contest },
  { names: ["CONTEST_SERVICE_TOKEN"], reason: "contest on", when: (f) => f.contest },
  { names: ["CRON_SECRET"], reason: "contest on", when: (f) => f.contest },
];

function present(env: EnvSource, name: string, minLength = 1): boolean {
  const value = env[name]?.trim();
  return Boolean(value) && (value as string).length >= minLength;
}

function describe(req: Requirement): string {
  const [canonical, ...alternatives] = req.names;
  const notes: string[] = [];
  if (alternatives.length) notes.push(`or ${alternatives.join(" / ")}`);
  if (req.minLength && req.minLength > 1) notes.push(`min ${req.minLength} chars`);
  if (req.reason) notes.push(req.reason);
  return notes.length ? `${canonical} (${notes.join(", ")})` : canonical;
}

/** Required vars that are unset, blank or too short, as human-readable labels. */
export function missingRequiredEnv(env: EnvSource, flags: RequiredEnvFlags): string[] {
  return REQUIREMENTS.filter((req) => !req.when || req.when(flags))
    .filter((req) => !req.names.some((name) => present(env, name, req.minLength)))
    .map(describe);
}

/**
 * True on a hosted production deploy. Same markers the rate limiter uses to
 * decide whether a missing Upstash config is an error (src/lib/rate-limit.ts).
 */
export function isHostedProductionEnv(env: EnvSource): boolean {
  return (
    env.VERCEL_ENV === "production" ||
    Boolean(env.RENDER_SERVICE_ID) ||
    env.RAILWAY_ENVIRONMENT === "production" ||
    Boolean(env.FLY_APP_NAME) ||
    env.ORIGIN_DEPLOYMENT_ENV === "production"
  );
}

/**
 * What the running app does about the required env. It never throws: on
 * Vercel `register()` runs when each function instance starts, AFTER the
 * deploy is promoted, so a throw there would not fail the deploy, it would
 * turn every request on that instance into a 500. Instead:
 *  - build time (scripts/check-required-env.ts, from `prebuild`) fails a
 *    VERCEL_ENV=production build;
 *  - at runtime `register()` logs a loud FATAL line + metric and keeps serving
 *    (only the routes that need the missing var fail);
 *  - /api/health reports 503 with the missing names for the deploy check and
 *    uptime monitor.
 */
export interface RequiredEnvStatus {
  missing: string[];
  hostedProduction: boolean;
  /** Missing vars on a hosted production deploy: page someone. */
  fatal: boolean;
}

export function requiredEnvStatus(env: EnvSource, flags: RequiredEnvFlags): RequiredEnvStatus {
  const missing = missingRequiredEnv(env, flags);
  const hostedProduction = isHostedProductionEnv(env);
  return { missing, hostedProduction, fatal: hostedProduction && missing.length > 0 };
}

/** The runtime log line for a status, or null when there is nothing to say. */
export function requiredEnvLogLine(status: RequiredEnvStatus): string | null {
  if (!status.missing.length) return null;
  const names = status.missing.join(", ");
  return status.fatal
    ? `[env] FATAL missing required production env: ${names}. Requests that need them will fail; set them on the deploy (see new-frontend/.env.example) and redeploy.`
    : `[env] missing required env (not fatal outside hosted production): ${names}`;
}

/**
 * The `env` component of /api/health. Down (→ 503) only on hosted production
 * with something missing; elsewhere a gap is reported but skipped so local
 * dev and previews stay green.
 */
export function requiredEnvHealth(status: RequiredEnvStatus): {
  status: "ok" | "down" | "skipped";
  detail?: string;
  missing?: string[];
} {
  if (!status.missing.length) return { status: "ok" };
  return {
    status: status.fatal ? "down" : "skipped",
    detail: "missing_required_env",
    missing: status.missing,
  };
}

/**
 * Build-time verdict: fail only a Vercel PRODUCTION build (Vercel exposes the
 * deploy's env vars to the build). Other hosts may not expose runtime secrets
 * at build time, so they rely on the runtime log + health check instead.
 */
export function shouldFailBuild(env: EnvSource, flags: RequiredEnvFlags): { fail: boolean; missing: string[] } {
  const missing = missingRequiredEnv(env, flags);
  return { fail: env.VERCEL_ENV === "production" && missing.length > 0, missing };
}
