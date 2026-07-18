import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMobileConfig } from "@/server/mobile/config";
import { consumeHandoffToken, isHandoffPurpose, issueHandoffToken } from "@/server/mobile/handoff";
import { parseAppVersionFromUserAgent } from "@/native/is-native-app";

test("mobile config defaults are the safe/dark posture", () => {
  delete process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE;
  delete process.env.MOBILE_KILL_SWITCH;
  delete process.env.MOBILE_LINK_OUT_ENABLED;
  const config = buildMobileConfig();
  assert.equal(config.minSupportedVersionCode, 0);
  assert.equal(config.killSwitch, false);
  // Play India anti-steering: purchase link-out ships OFF (plan §10.2).
  assert.equal(config.linkOutEnabled, false);
  assert.equal(config.serviceWorkerEnabled, true);
  assert.equal(config.googleNativeLoginEnabled, true);
  assert.equal(config.webviewFloor, 111);
  assert.ok(!Number.isNaN(Date.parse(config.serverTime)));
});

test("mobile config reads env overrides", () => {
  process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE = "10200";
  process.env.MOBILE_KILL_SWITCH = "1";
  process.env.MOBILE_LINK_OUT_ENABLED = "true";
  try {
    const config = buildMobileConfig();
    assert.equal(config.minSupportedVersionCode, 10200);
    assert.equal(config.killSwitch, true);
    assert.equal(config.linkOutEnabled, true);
  } finally {
    delete process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE;
    delete process.env.MOBILE_KILL_SWITCH;
    delete process.env.MOBILE_LINK_OUT_ENABLED;
  }
});

test("handoff tokens are single-use and purpose-bound", async () => {
  const token = await issueHandoffToken("user-123", "premium");
  assert.ok(token.length >= 32);

  const first = await consumeHandoffToken(token);
  assert.deepEqual(first, { userId: "user-123", purpose: "premium" });

  // Replay must fail — the token is consumed atomically.
  const second = await consumeHandoffToken(token);
  assert.equal(second, null);
});

test("handoff consumption rejects unknown and oversized tokens", async () => {
  assert.equal(await consumeHandoffToken("not-a-real-token"), null);
  assert.equal(await consumeHandoffToken("x".repeat(500)), null);
  assert.equal(await consumeHandoffToken(""), null);
});

test("handoff purposes are an allowlist (no open-redirect surface)", () => {
  assert.ok(isHandoffPurpose("premium"));
  assert.ok(!isHandoffPurpose("https://evil.example"));
  assert.ok(!isHandoffPurpose("__proto__"));
});

test("shell versionCode parses from the app UA suffix only", () => {
  assert.equal(parseAppVersionFromUserAgent("Mozilla/5.0 ... OriginApp/10203 (Android 15; Pixel 8)"), 10203);
  assert.equal(parseAppVersionFromUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/126.0"), null);
  assert.equal(parseAppVersionFromUserAgent(null), null);
  assert.equal(parseAppVersionFromUserAgent("OriginApp/notanumber"), null);
});
