import assert from "node:assert/strict";
import test from "node:test";

import { NOW_OFFER_CHANNEL_ID } from "../../src/server/now/now-realtime";
import { buildFcmPayload } from "../../src/server/push/fcm";

test("an Origin NOW offer goes out urgent, in the offers channel, expiring with the offer (B88)", () => {
  const payload = buildFcmPayload("tok", {
    title: "New doubt waiting",
    body: "A physics doubt is waiting for you. Tap to accept.",
    route: "/now/solver",
    data: { kind: "now_offer", offerId: "off_1" },
    android: { channelId: NOW_OFFER_CHANNEL_ID, urgent: true, ttlSeconds: 24.6 },
  });
  assert.deepEqual(payload.message.android, { priority: "HIGH", ttl: "25s", notification: { channel_id: "now_offers" } });
  assert.deepEqual(payload.message.data, { kind: "now_offer", offerId: "off_1", route: "/now/solver" });
  assert.equal(NOW_OFFER_CHANNEL_ID, "now_offers", "must match NotificationChannels.NOW_OFFERS in the Android shell");
});

test("other messages keep normal priority with no ttl or channel", () => {
  const payload = buildFcmPayload("tok", { title: "t", body: "b" });
  assert.deepEqual(payload.message.android, { priority: "NORMAL" });
  assert.deepEqual(payload.message.data, {});
});

test("a lapsed offer gets a zero ttl, never a negative one", () => {
  const payload = buildFcmPayload("tok", { title: "t", body: "b", android: { urgent: true, ttlSeconds: -3 } });
  assert.equal(payload.message.android.ttl, "0s");
});
