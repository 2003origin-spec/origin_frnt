/**
 * Runtime-aware feature-flag checks for API handlers.
 *
 * `src/lib/feature-flags.ts` is env-only and importable from client code, so it
 * cannot consult the Redis-backed `/admin/incidents` kill-switch. Until this
 * module existed the only place the override was honoured was the middleware
 * prefix table (`FLAG_KILL_PREFIXES`), so a killed flag still served every
 * handler whose path was not in that table. Server code that gates a surface
 * should call these instead of `requireFeatureEnabled` so that an operator
 * flipping a flag in /admin/incidents actually stops the surface within one
 * snapshot TTL, no deploy needed.
 *
 * Semantics: an explicit override ("on"/"off") wins; no override falls back to
 * the env/default resolution in `isFeatureEnabled`.
 */

import { FeatureDisabledError, isFeatureEnabled, type FlagKey } from "@/lib/feature-flags";
import { getFlagOverride } from "@/server/incidents";

export async function isFeatureEnabledRuntime(flag: FlagKey): Promise<boolean> {
  const override = await getFlagOverride(flag);
  if (override !== null) return override;
  return isFeatureEnabled(flag);
}

export async function requireFeatureEnabledRuntime(flag: FlagKey): Promise<void> {
  if (!(await isFeatureEnabledRuntime(flag))) {
    throw new FeatureDisabledError(flag);
  }
}
