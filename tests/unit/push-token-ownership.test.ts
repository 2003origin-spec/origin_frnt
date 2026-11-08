/**
 * DELETE /api/mobile/push-tokens only revokes the CALLER's token.
 *
 * revokeDeviceToken used to match on the token value alone, so anyone holding
 * another user's FCM token could silence that user's push. Register keeps its
 * deliberate re-bind (one token = one device = one owner; the newest sign-in on
 * that device takes it over), which is what this test pins as unchanged.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakePool, stubModules, userPostgresStub } from "./_module-stubs";

const pool = createFakePool();
stubModules({ "@/server/user-postgres": userPostgresStub(pool) });
globalThis.__originDeviceTokensEnsured = true;

/* eslint-disable @typescript-eslint/no-require-imports */
const tokens = require("@/server/push/device-tokens") as typeof import("@/server/push/device-tokens");
/* eslint-enable @typescript-eslint/no-require-imports */

test("revoke is scoped to the owner", async () => {
  pool.reset();
  pool.handler = (sql, params) =>
    sql.startsWith("UPDATE notif.device_tokens") ? { rows: params[1] === "owner" ? [{}] : [] } : undefined;

  assert.equal(await tokens.revokeDeviceToken("fcm_token_abcdef", "owner"), true);
  assert.equal(await tokens.revokeDeviceToken("fcm_token_abcdef", "someone_else"), false);

  const [first] = pool.matching("UPDATE notif.device_tokens");
  assert.match(first.sql, /WHERE token = \$1 AND user_id = \$2/);
  assert.deepEqual(first.params, ["fcm_token_abcdef", "owner"]);
});

test("register still re-binds a token to the newest owner (one device, one owner)", async () => {
  pool.reset();
  await tokens.registerDeviceToken({ userId: "new_owner", token: "fcm_token_abcdef" });
  const [upsert] = pool.matching("INSERT INTO notif.device_tokens");
  assert.match(upsert.sql, /ON CONFLICT \(token\) DO UPDATE SET\s+user_id = EXCLUDED\.user_id/);
});

test("the mobile DELETE handler passes the caller's user id", () => {
  const src = readFileSync(new URL("../../src/app/api/mobile/[...slug]/route.ts", import.meta.url), "utf8");
  assert.match(src, /await revokeDeviceToken\(token, userId\)/);
  assert.doesNotMatch(src, /revokeDeviceToken\(token\)/);
});
