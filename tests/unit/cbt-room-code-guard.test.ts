/**
 * CBT join wrong-room-code guard (review finding 7, round-2 F3). The
 * load-bearing case: a CORRECT code always gets in, even after the (ip, room)
 * key has spent its wrong-code budget — one student must not lock a whole lab
 * out. Once the budget is spent, only further WRONG codes are refused (429).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryLimiter } from "@/lib/rate-limit";
import { withRoomCodeGuard } from "@/server/cbt/room-code-guard";

const wrongCode = () => Promise.reject(Object.assign(new Error("Incorrect room code."), { status: 403 }));

test("a spent budget turns further wrong codes into 429; the right code still gets in", async () => {
  const limiter = createMemoryLimiter(3, 60_000, { failClosed: true });
  for (let i = 0; i < 3; i += 1) {
    await assert.rejects(withRoomCodeGuard(limiter, "1.1.1.1:room", wrongCode), /Incorrect room code/);
  }
  // budget spent: the next wrong code is locked, not a plain 403
  assert.deepEqual(await withRoomCodeGuard(limiter, "1.1.1.1:room", wrongCode), { locked: true });
  // ...but a classmate on the same NAT IP with the right code joins
  let ran = false;
  const result = await withRoomCodeGuard(limiter, "1.1.1.1:room", async () => {
    ran = true;
    return "joined";
  });
  assert.deepEqual(result, { locked: false, value: "joined" });
  assert.equal(ran, true);
  // another (ip, room) key is unaffected by the first key's misses
  await assert.rejects(withRoomCodeGuard(limiter, "2.2.2.2:room", wrongCode), /Incorrect room code/);
});

test("successes and non-403 errors never spend the budget", async () => {
  const limiter = createMemoryLimiter(1, 60_000, { failClosed: true });
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(await withRoomCodeGuard(limiter, "k", async () => i), { locked: false, value: i });
    await assert.rejects(
      withRoomCodeGuard(limiter, "k", () => Promise.reject(Object.assign(new Error("closed"), { status: 410 }))),
    );
  }
  assert.equal(await limiter.remaining("k"), 1);
});
