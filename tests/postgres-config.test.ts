import test from "node:test";
import assert from "node:assert/strict";

import { createPostgresPoolConfig, normalizePostgresConnectionString } from "../src/server/postgres-config";

test("remote postgres URLs are normalized to verify-full SSL mode", () => {
  const config = createPostgresPoolConfig(
    "postgresql://user:pass@example.neon.tech/db?sslmode=require&channel_binding=require",
    5,
  );
  const url = new URL(config.connectionString);

  assert.equal(url.searchParams.get("sslmode"), "verify-full");
  assert.equal(url.searchParams.get("channel_binding"), "require");
  assert.equal(config.ssl, undefined);
});

test("remote postgres URLs without sslmode get verify-full", () => {
  const normalized = normalizePostgresConnectionString("postgresql://user:pass@example.neon.tech/db");
  const url = new URL(normalized);

  assert.equal(url.searchParams.get("sslmode"), "verify-full");
});

test("local postgres URLs do not force SSL", () => {
  const config = createPostgresPoolConfig("postgresql://origin:origin@127.0.0.1:5432/origin", 5);

  assert.equal(config.connectionString, "postgresql://origin:origin@127.0.0.1:5432/origin");
  assert.equal(config.ssl, false);
});

test("explicit sslmode disable is preserved", () => {
  const config = createPostgresPoolConfig("postgresql://user:pass@example.neon.tech/db?sslmode=disable", 5);
  const url = new URL(config.connectionString);

  assert.equal(url.searchParams.get("sslmode"), "disable");
  assert.equal(config.ssl, false);
});

test("pool config never disables remote certificate verification", () => {
  const config = createPostgresPoolConfig("postgresql://user:pass@example.neon.tech/db", 5);

  assert.notDeepEqual(config.ssl, { rejectUnauthorized: false });
});
