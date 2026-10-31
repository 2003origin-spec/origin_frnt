/**
 * Build-time required-env check, run first in the `prebuild` npm hook.
 *
 * Fails a Vercel PRODUCTION build (VERCEL_ENV=production; Vercel exposes the
 * deploy's env vars to the build) when a required var is missing, so the bad
 * deploy is never promoted. The runtime side (src/instrumentation.ts) only
 * logs and /api/health reports 503, because a throw at instance start would
 * 500 every request instead of failing the deploy.
 *
 * Everywhere else (local builds, previews, CI) it only prints what is missing.
 * The list lives in src/lib/required-env.ts.
 */

import { isFeatureEnabled } from "../src/lib/feature-flags";
import { shouldFailBuild } from "../src/lib/required-env";

// prebuild runs before `next build` sets NODE_ENV, so make the feature flags
// resolve with their production defaults on a production build.
if (process.env.VERCEL_ENV === "production") {
  Object.assign(process.env, { NODE_ENV: "production" });
}

const verdict = shouldFailBuild(process.env, {
  cbtModule: isFeatureEnabled("cbtModule"),
  originNow: isFeatureEnabled("originNow"),
  contest: isFeatureEnabled("contest"),
});

if (verdict.fail) {
  console.error(
    `[env] FATAL: this production build is missing required env: ${verdict.missing.join(", ")}.\n` +
      "Set them in Vercel (Project → Settings → Environment Variables, Production) and redeploy. " +
      "See new-frontend/.env.example.",
  );
  process.exit(1);
}
if (verdict.missing.length) {
  console.warn(`[env] missing required env (only fatal for VERCEL_ENV=production builds): ${verdict.missing.join(", ")}`);
} else {
  console.log("[env] required env present");
}
