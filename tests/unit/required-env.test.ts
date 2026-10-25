/**
 * Required-env check (src/lib/required-env.ts): build time
 * (scripts/check-required-env.ts), boot log (src/instrumentation.ts) and
 * /api/health.
 *
 * What has to hold: the always-required set is reported when absent, flag-gated
 * secrets are only required while their flag is on, blank values count as
 * missing, the OGCode DB accepts its fallback names, only a VERCEL_ENV=production
 * build fails, and at runtime nothing throws: hosted production logs FATAL and
 * health goes down (503).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isHostedProductionEnv,
  missingRequiredEnv,
  requiredEnvHealth,
  requiredEnvLogLine,
  requiredEnvStatus,
  shouldFailBuild,
  type RequiredEnvFlags,
} from "@/lib/required-env";

const OFF: RequiredEnvFlags = { cbtModule: false, originNow: false, contest: false };
const ALL_ON: RequiredEnvFlags = { cbtModule: true, originNow: true, contest: true };

const BASE = {
  AUTH_JWT_SECRET_CURRENT: "jwt",
  USER_DATABASE_URL: "postgres://user",
  OGCODE_DATABASE_URL: "postgres://ogcode",
  INTERNAL_CRON_TOKEN: "cron",
  UPSTASH_REDIS_REST_URL: "https://upstash",
  UPSTASH_REDIS_REST_TOKEN: "token",
};

const FLAGGED = {
  CBT_PARTICIPANT_TOKEN_SECRET: "x".repeat(32),
  NOW_KYC_ENCRYPTION_KEY: "kyc",
  R2_PRIVATE_BUCKET: "private",
  CONTEST_SERVICE_URL: "https://contest",
  CONTEST_SERVICE_TOKEN: "contest",
  CRON_SECRET: "vercel-cron",
};

test("an empty env reports every always-required var and nothing flag-gated", () => {
  const missing = missingRequiredEnv({}, OFF);
  assert.deepEqual(missing, [
    "AUTH_JWT_SECRET_CURRENT",
    "USER_DATABASE_URL",
    "OGCODE_DATABASE_URL (or OGCODE_POSTGRES_URL / POSTGRES_URL / DATABASE_URL)",
    "INTERNAL_CRON_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]);
});

test("a complete base env with every flag off is clean", () => {
  assert.deepEqual(missingRequiredEnv(BASE, OFF), []);
});

test("blank and whitespace-only values count as missing", () => {
  const missing = missingRequiredEnv({ ...BASE, INTERNAL_CRON_TOKEN: "   ", USER_DATABASE_URL: "" }, OFF);
  assert.deepEqual(missing, ["USER_DATABASE_URL", "INTERNAL_CRON_TOKEN"]);
});

test("the OGCode DB is satisfied by any of its fallback names", () => {
  const { OGCODE_DATABASE_URL: _drop, ...rest } = BASE;
  void _drop;
  assert.deepEqual(missingRequiredEnv({ ...rest, DATABASE_URL: "postgres://fallback" }, OFF), []);
  assert.equal(missingRequiredEnv(rest, OFF).length, 1);
});

test("flag-gated secrets are required only while their flag is on", () => {
  assert.deepEqual(missingRequiredEnv(BASE, { ...OFF, cbtModule: true }), [
    "CBT_PARTICIPANT_TOKEN_SECRET (min 32 chars, cbtModule on)",
  ]);
  assert.deepEqual(missingRequiredEnv(BASE, { ...OFF, originNow: true }), [
    "NOW_KYC_ENCRYPTION_KEY (originNow on)",
    "R2_PRIVATE_BUCKET (originNow on)",
  ]);
  assert.deepEqual(missingRequiredEnv(BASE, { ...OFF, contest: true }), [
    "CONTEST_SERVICE_URL (contest on)",
    "CONTEST_SERVICE_TOKEN (contest on)",
    "CRON_SECRET (contest on)",
  ]);
  assert.deepEqual(missingRequiredEnv({ ...BASE, ...FLAGGED }, ALL_ON), []);
});

test("a CBT secret shorter than 32 chars is reported", () => {
  const env = { ...BASE, ...FLAGGED, CBT_PARTICIPANT_TOKEN_SECRET: "short" };
  assert.deepEqual(missingRequiredEnv(env, ALL_ON), ["CBT_PARTICIPANT_TOKEN_SECRET (min 32 chars, cbtModule on)"]);
});

test("hosted production markers match the rate limiter's", () => {
  assert.equal(isHostedProductionEnv({}), false);
  assert.equal(isHostedProductionEnv({ VERCEL_ENV: "preview" }), false);
  assert.equal(isHostedProductionEnv({ VERCEL_ENV: "production" }), true);
  assert.equal(isHostedProductionEnv({ RENDER_SERVICE_ID: "srv-1" }), true);
  assert.equal(isHostedProductionEnv({ RAILWAY_ENVIRONMENT: "production" }), true);
  assert.equal(isHostedProductionEnv({ FLY_APP_NAME: "origin" }), true);
  assert.equal(isHostedProductionEnv({ ORIGIN_DEPLOYMENT_ENV: "production" }), true);
});

test("runtime status never throws; fatal only on hosted production with a gap", () => {
  const preview = requiredEnvStatus({ VERCEL_ENV: "preview" }, OFF);
  assert.equal(preview.missing.length, 6);
  assert.equal(preview.fatal, false);

  const prod = requiredEnvStatus({ ...BASE, VERCEL_ENV: "production" }, { ...OFF, contest: true });
  assert.equal(prod.fatal, true);
  assert.equal(prod.missing.length, 3);

  const clean = requiredEnvStatus({ ...BASE, ...FLAGGED, VERCEL_ENV: "production" }, ALL_ON);
  assert.deepEqual(clean, { missing: [], hostedProduction: true, fatal: false });
});

test("runtime log line is a loud FATAL on hosted production, a warning elsewhere, silent when clean", () => {
  const fatal = requiredEnvLogLine(requiredEnvStatus({ ...BASE, RENDER_SERVICE_ID: "srv" }, { ...OFF, contest: true }));
  assert.match(fatal ?? "", /^\[env\] FATAL missing required production env: CONTEST_SERVICE_URL/);
  const warn = requiredEnvLogLine(requiredEnvStatus({}, OFF));
  assert.match(warn ?? "", /not fatal outside hosted production/);
  assert.equal(requiredEnvLogLine(requiredEnvStatus(BASE, OFF)), null);
});

test("/api/health env component: down with the names on hosted production, skipped elsewhere", () => {
  const down = requiredEnvHealth(requiredEnvStatus({ ...BASE, VERCEL_ENV: "production" }, { ...OFF, cbtModule: true }));
  assert.equal(down.status, "down");
  assert.deepEqual(down.missing, ["CBT_PARTICIPANT_TOKEN_SECRET (min 32 chars, cbtModule on)"]);
  assert.equal(requiredEnvHealth(requiredEnvStatus({ VERCEL_ENV: "preview" }, OFF)).status, "skipped");
  assert.deepEqual(requiredEnvHealth(requiredEnvStatus(BASE, OFF)), { status: "ok" });
});

test("the build fails only for a VERCEL_ENV=production build with a gap", () => {
  assert.equal(shouldFailBuild({ ...BASE, VERCEL_ENV: "production" }, { ...OFF, originNow: true }).fail, true);
  assert.equal(shouldFailBuild({ ...BASE, ...FLAGGED, VERCEL_ENV: "production" }, ALL_ON).fail, false);
  assert.equal(shouldFailBuild({ VERCEL_ENV: "preview" }, OFF).fail, false);
  // Other hosts may not expose runtime secrets at build time: runtime checks only.
  assert.equal(shouldFailBuild({ RENDER_SERVICE_ID: "srv" }, OFF).fail, false);
  assert.equal(shouldFailBuild({}, OFF).missing.length, 6);
});

test(".env.example documents every required name", () => {
  const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
  const names = [...Object.keys(BASE), ...Object.keys(FLAGGED)];
  for (const name of names) {
    assert.match(example, new RegExp(`^#?\\s*${name}=`, "m"), `${name} missing from .env.example`);
  }
});
