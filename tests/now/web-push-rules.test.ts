import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { offerNotification } from "../../src/sw/now-push";
import { isAllowedPushEndpoint, isGoneStatus, vapidAudience, vapidJwk } from "../../src/server/now/web-push-rules";

test("only https endpoints on known push services are accepted", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://web.push.apple.com/QOk",
    "https://api.push.apple.com/3/device/x",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ]) {
    assert.equal(isAllowedPushEndpoint(ok), true, ok);
  }
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://evil.example.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.com/x",
    "https://push.apple.com/x",
    "https://user:pass@fcm.googleapis.com/x",
    "https://169.254.169.254/latest/meta-data",
    "not a url",
    `https://fcm.googleapis.com/${"a".repeat(1000)}`,
  ]) {
    assert.equal(isAllowedPushEndpoint(bad), false, bad);
  }
});

test("VAPID keys in the usual base64url format become a P-256 JWK; bad keys are refused", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-65);
  const d = privateKey.export({ format: "jwk" }).d!;
  const jwk = vapidJwk(raw.toString("base64url"), d);
  assert.ok(jwk);
  assert.deepEqual([jwk.x, jwk.y, jwk.d], [publicKey.export({ format: "jwk" }).x, publicKey.export({ format: "jwk" }).y, d]);
  assert.equal(vapidJwk("short", d), null);
  assert.equal(vapidJwk(raw.toString("base64url"), "c2hvcnQ"), null);
  assert.equal(vapidAudience("https://fcm.googleapis.com/fcm/send/abc"), "https://fcm.googleapis.com");
  assert.equal(isGoneStatus(410), true);
  assert.equal(isGoneStatus(404), true);
  assert.equal(isGoneStatus(429), false);
});

test("the alert names the subject, difficulty and seconds left, with a fallback when there is no offer", () => {
  const now = Date.parse("2026-10-17T13:00:00Z");
  assert.deepEqual(
    offerNotification({ offer: { expiresAt: "2026-10-17T13:00:20Z", card: { subject: "physics", difficulty: "hard" } } }, now),
    { title: "New Physics doubt · Hard", body: "Tap to open your shift: 20 seconds to accept." },
  );
  assert.equal(offerNotification({ offer: { expiresAt: "2026-10-17T12:59:00Z" } }, now).body, "Tap to open your shift.");
  assert.match(offerNotification(null, now).body, /Open your shift/);
  assert.match(offerNotification({ offer: null }, now).title, /Origin NOW/);
});
