/**
 * Ask later (decision B94) against a real Postgres: off by default; post with
 * a note and a photo (coins held, same key once); solvers in the subject see
 * it, one claims it (one at a time; nobody else can); the answer is checked
 * for contact details; the student accepts with stars and a tip (solver paid,
 * pending 24 h); unanswered → refunded; claims run out; untouched answers are
 * accepted; a report waits for the case and settles either way; cancel.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { resolveReport } from "@/server/now/after-call-service";
import {
  acceptLaterAnswer,
  answerLater,
  cancelAskLater,
  claimLater,
  createLaterPhotoUpload,
  getLaterForStudent,
  listLaterQueue,
  postAskLater,
  quoteAskLater,
  reportLaterAnswer,
  runAskLaterSweep,
} from "@/server/now/ask-later-service";
import { getWalletBalance } from "@/server/now/ledger-store";

import { closePool, makeId, rawPool } from "./_db";
import { EASY_HUMAN, NOW_SKIP, WELCOME, assertLedgerBalanced, cleanupNowFixtures, seedAttemptedQuestion, seedHelper, seedStudent, seedUser, setFeatures, setup } from "./_now";

const savedEnv = { ...process.env };
test.before(() => {
  process.env.R2_ENDPOINT = "https://acct.r2.cloudflarestorage.invalid";
  process.env.R2_ACCESS_KEY_ID = "app-key";
  process.env.R2_SECRET_ACCESS_KEY = "app-secret";
  process.env.R2_BUCKET_NAME = "origin";
  process.env.R2_PRIVATE_BUCKET = "origin-private";
});
test.after(async () => {
  process.env = savedEnv;
  if (!NOW_SKIP) await setup();
  await cleanupNowFixtures();
  await closePool();
});

const code = (c: string) => (e: { code?: string }) => e.code === c;
const PRICE = Math.round((EASY_HUMAN * 60) / 100);
const ANSWER = "Resolve the motion along the incline: a = g sin θ, then use v^2 = 2as to get v = 14 m/s.";
const HOUR = 60 * 60_000;

async function student() {
  const id = await seedStudent();
  const question = await seedAttemptedQuestion(id, "physics");
  return { id, question };
}

test("post, claim, answer, accept with a tip", { skip: NOW_SKIP }, async () => {
  await setup();
  const a = await student();
  await assert.rejects(postAskLater(a.id, { questionId: a.question }, makeId("k")), code("ask_later_off"));
  await setFeatures({ askLater: true });

  const quote = await quoteAskLater(a.id, a.question);
  assert.equal(quote.priceCoins, PRICE, "60% of the live human price by default");
  const upload = await createLaterPhotoUpload(a.id, { mimeType: "image/jpeg", sizeBytes: 2048 });
  assert.match(upload.uploadUrl, /\/origin-private\/origin-now\/ask-later\/student\//, "private bucket");
  await assert.rejects(postAskLater(a.id, { questionId: a.question, note: "call 98765 43210" }, makeId("k")), code("invalid_note"));
  await assert.rejects(
    postAskLater(a.id, { questionId: a.question, photoKeys: ["origin-now/ask-later/student/someone/x.jpg"] }, makeId("k")),
    code("invalid_photos"),
  );
  const key = makeId("k");
  const posted = await postAskLater(a.id, { questionId: a.question, note: "Stuck at step 2", photoKeys: [upload.objectKey] }, key);
  assert.equal(posted.status, "open");
  assert.equal(posted.photos.length, 1);
  assert.equal((await postAskLater(a.id, { questionId: a.question }, key)).id, posted.id, "the same key posts once");
  const raceKey = makeId("k");
  const [r1, r2] = await Promise.all([
    postAskLater(a.id, { questionId: a.question }, raceKey),
    postAskLater(a.id, { questionId: a.question }, raceKey),
  ]);
  assert.equal(r1.id, r2.id, "two taps at once with the same key: one doubt, no error");
  await cancelAskLater(a.id, r1.id);
  assert.equal((await getWalletBalance(a.id)).available, WELCOME - PRICE);

  const solver = await seedHelper("physics");
  const other = await seedHelper("physics");
  const queue = await listLaterQueue(solver.userId);
  assert.ok(queue.open.some((i) => i.id === posted.id));
  assert.equal(queue.open.find((i) => i.id === posted.id)?.otherName, "Meera", "first name only");
  assert.equal((await listLaterQueue((await seedHelper("chemistry")).userId)).open.some((i) => i.id === posted.id), false, "other subjects do not see it");

  await claimLater(solver.userId, posted.id);
  await assert.rejects(claimLater(other.userId, posted.id), code("already_taken"));
  const second = await student();
  const p2 = await postAskLater(second.id, { questionId: second.question }, makeId("k"));
  await assert.rejects(claimLater(solver.userId, p2.id), code("one_at_a_time"));

  await assert.rejects(answerLater(solver.userId, posted.id, { text: "too short" }), code("invalid_answer"));
  await assert.rejects(answerLater(solver.userId, posted.id, { text: `${ANSWER} Mail me at ravi@example.com` }), code("invalid_answer"));
  await assert.rejects(answerLater(other.userId, posted.id, { text: ANSWER }), code("not_found"));
  const photo = await createLaterPhotoUpload(solver.userId, { mimeType: "image/png", sizeBytes: 100, laterId: posted.id });
  await answerLater(solver.userId, posted.id, { text: ANSWER, photoKeys: [photo.objectKey] });

  const seen = await getLaterForStudent(a.id, posted.id);
  assert.equal(seen.status, "answered");
  assert.equal(seen.answer?.text, ANSWER);
  assert.equal(seen.answer?.photos.length, 1);
  assert.equal(seen.otherName, "Ravi");
  await assert.rejects(acceptLaterAnswer(a.id, posted.id, { stars: 6 }), code("invalid_stars"));
  await acceptLaterAnswer(a.id, posted.id, { stars: 5, tipCoins: 5 });
  assert.equal((await getWalletBalance(solver.userId)).pending, PRICE + 5, "price (no commission in tests) and tip, pending 24 h");
  assert.equal((await getWalletBalance(a.id)).available, WELCOME - PRICE - 5);
  await assert.rejects(acceptLaterAnswer(a.id, posted.id, { stars: 5 }), code("invalid_state"), "once");
  await cancelAskLater(second.id, p2.id);
  await assertLedgerBalanced();
});

test("the sweep: claims run out, unanswered doubts are refunded, untouched answers are accepted", { skip: NOW_SKIP }, async () => {
  await setup();
  await setFeatures({ askLater: true });
  const solver = await seedHelper("physics");

  const a = await student();
  const claimed = await postAskLater(a.id, { questionId: a.question }, makeId("k"));
  await claimLater(solver.userId, claimed.id);
  const t1 = new Date(Date.now() + 31 * 60_000);
  assert.ok((await runAskLaterSweep(t1)).claimsReleased >= 1);
  assert.equal((await getLaterForStudent(a.id, claimed.id)).status, "open", "back in the queue after 30 minutes");

  const t2 = new Date(Date.now() + 13 * HOUR);
  assert.ok((await runAskLaterSweep(t2)).expired >= 1);
  assert.equal((await getLaterForStudent(a.id, claimed.id)).status, "expired");
  assert.equal((await getWalletBalance(a.id)).available, WELCOME, "coins back");

  const b = await student();
  const answered = await postAskLater(b.id, { questionId: b.question }, makeId("k"));
  await claimLater(solver.userId, answered.id);
  await answerLater(solver.userId, answered.id, { text: ANSWER });
  await rawPool().query(`UPDATE now.later_requests SET answered_at = NOW() - interval '49 hours' WHERE id = $1`, [answered.id]);
  assert.ok((await runAskLaterSweep()).autoAccepted >= 1);
  assert.equal((await getLaterForStudent(b.id, answered.id)).status, "accepted");
  await assertLedgerBalanced();
});

test("a reported answer waits for the case: dismissed pays the solver, upheld refunds the student", { skip: NOW_SKIP }, async () => {
  await setup();
  await setFeatures({ askLater: true });
  const admin = await seedUser("Admin Person");

  for (const outcome of ["dismissed", "upheld"] as const) {
    const solver = await seedHelper("physics");
    const s = await student();
    const item = await postAskLater(s.id, { questionId: s.question }, makeId("k"));
    await claimLater(solver.userId, item.id);
    await answerLater(solver.userId, item.id, { text: ANSWER });
    await reportLaterAnswer(s.id, item.id, { reason: "wrong_content", details: "The final value is wrong" });
    assert.equal((await getLaterForStudent(s.id, item.id)).status, "disputed");
    const report = (await rawPool().query(`SELECT id FROM now.reports WHERE later_request_id = $1`, [item.id])).rows[0];
    await resolveReport(admin, report.id, outcome, "Checked the working against the key.");
    const after = await getLaterForStudent(s.id, item.id);
    if (outcome === "dismissed") {
      assert.equal(after.status, "accepted");
      assert.equal((await getWalletBalance(solver.userId)).pending, PRICE);
    } else {
      assert.equal(after.status, "cancelled");
      assert.equal((await getWalletBalance(s.id)).available, WELCOME, "student refunded");
      const helper = (await rawPool().query(`SELECT verification_status FROM now.helpers WHERE id = $1`, [solver.helperId])).rows[0];
      assert.equal(helper.verification_status, "restricted", "an upheld report restricts the solver, as for calls");
    }
  }
  await assertLedgerBalanced();
});
