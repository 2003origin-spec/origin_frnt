/**
 * Next.js instrumentation hook. `register()` runs once per server instance
 * before it serves requests (never during `next build`).
 *
 * Missing required env is NOT thrown here: on Vercel this runs when each
 * function instance starts, after the deploy is already promoted, so a throw
 * would not fail the deploy, it would 500 every request on the instance. The
 * hard fail is the build-time check (scripts/check-required-env.ts, run from
 * `prebuild`); here we log a loud FATAL line + metric and keep serving, and
 * /api/health reports 503 with the missing names.
 *
 * The check only runs in the Node.js runtime; the edge middleware bundle reads
 * the same env and would only repeat it.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { requiredEnvStatus, requiredEnvLogLine } = await import("@/lib/required-env");
  const { isFeatureEnabled } = await import("@/lib/feature-flags");

  const status = requiredEnvStatus(process.env, {
    cbtModule: isFeatureEnabled("cbtModule"),
    originNow: isFeatureEnabled("originNow"),
    contest: isFeatureEnabled("contest"),
  });
  const line = requiredEnvLogLine(status);
  if (!line) return;
  if (status.fatal) {
    console.error(line);
    const { metric } = await import("@/lib/metrics");
    metric("origin.env.missing_required", { count: status.missing.length, names: status.missing.join(",") });
  } else if (process.env.NODE_ENV === "production") {
    // Not hosted production (preview, self-hosted staging): warn, keep serving.
    console.warn(line);
  }
}
