/**
 * P1 integration — the premium test surfaces refuse a zero-purchase student,
 * end to end through the real DB-backed scope. Runs only when USER_DATABASE_URL
 * is configured (CI + opt-in local), like the other phase-13 tests.
 *
 * Covers the service entry points behind POST /api/assessments/tests/custom,
 * POST /api/assessments/tests/full-length and GET /api/assessments/tests/:id
 * (the route handlers map `status === 403` to a forbidden response unchanged):
 *   - free student: custom test → 403 premium_required; full-length → 403;
 *     an un-attempted persisted test → 403; the SAME test once attempted → 200.
 *   - Physics-only buyer: JEE Main → PresetLockedError naming Chemistry + Maths.
 *
 * See V1/docs/bug-fixes/05-payments-entitlements.md §P1.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "1";
process.env.TEACHER_LAUNCH_STUDY_MODES = "1";

import { ensureUserSchema } from "@/server/db-users";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import { upsertCreatedSubscription } from "@/server/subscriptions/subscriptions-store";
import { processSubscriptionWebhook } from "@/server/subscriptions/subscriptions-service";
import { getStudentScope } from "@/server/study-scope";
import { createCustomTest, getTestDetail } from "@/server/assessments";
import { PresetLockedError, createFullLengthTest } from "@/server/assessments/full-test-service";
import { persistGeneratedCustomTest } from "@/server/analytics-store";
import { isOgcodePostgresConfigured } from "@/server/postgres";
import type { AppStore, StoredUser } from "@/legacy/store";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured() || !isOgcodePostgresConfigured();
const it = test;

type Err403 = Error & { status?: number; code?: string; missing?: string[] };

function isPremiumRequired(err: Err403): boolean {
  assert.equal(err.status, 403);
  assert.equal(err.code, "premium_required");
  return true;
}

async function seedStudent(): Promise<StoredUser> {
  await ensureUserSchema();
  await ensureSubscriptionsSchema();
  const id = makeId("user_p1gate");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash)
     VALUES ($1, 'P1 Gate Test', $2, 'student', 'test-no-login') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@example.com`],
  );
  return { id, role: "student" } as StoredUser;
}

async function grantPhysics(userId: string): Promise<string> {
  const evt = makeId("evt");
  const subId = makeId("rzpsub").replace(/_/g, "");
  await upsertCreatedSubscription({
    userId,
    subject: "physics",
    razorpayPlanId: "plan_physics",
    razorpaySubscriptionId: subId,
    shortUrl: null,
    amountMinor: 49900,
  });
  await processSubscriptionWebhook(evt, {
    event: "subscription.activated",
    payload: {
      subscription: { entity: { id: subId, current_end: Math.floor(Date.now() / 1000) + 30 * 86400 } },
    },
  });
  return evt;
}

async function cleanup(userId: string, eventIds: string[], testIds: string[]) {
  const pool = rawPool();
  if (testIds.length) {
    await pool.query(`DELETE FROM analytics.custom_tests WHERE id = ANY($1)`, [testIds]).catch(() => undefined);
  }
  if (eventIds.length) {
    await pool.query(`DELETE FROM subscriptions.webhook_events WHERE event_id = ANY($1)`, [eventIds]);
  }
  await pool.query(`DELETE FROM subscriptions.user_subscriptions WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
}

/**
 * The slice of AppStore getTestDetail reads for a persisted test with no
 * questions: `tests` (seeded lookup), `questions` (local lookup) and
 * `testResults` (the attempted-before carve-out).
 */
function storeWith(results: Array<{ userId: string; testId: string }>): AppStore {
  return { tests: [], questions: [], practiceAttempts: [], testResults: results } as unknown as AppStore;
}

it("P1: a free student cannot build a custom test or a full-length mock", { skip: SKIP }, async () => {
  const user = await seedStudent();
  try {
    const scope = await getStudentScope(user.id, user.role);
    assert.equal(scope.premiumLocked, true);
    assert.deepEqual(scope.entitledSubjects, []);
    assert.ok(scope.subjects.length > 0, "scope.subjects stays padded for the OG Code pool");

    await assert.rejects(
      createCustomTest(storeWith([]), user, { subject: "physics", question_count: 10 }),
      isPremiumRequired,
    );
    await assert.rejects(
      createCustomTest(storeWith([]), user, { subject: "mixed", question_count: 10 }),
      isPremiumRequired,
    );
    await assert.rejects(
      createFullLengthTest({ userId: user.id, preset: "jee-main", scope }),
      isPremiumRequired,
    );
    await assert.rejects(
      createFullLengthTest({ userId: user.id, preset: "neet", scope }),
      isPremiumRequired,
    );
  } finally {
    await cleanup(user.id, [], []);
  }
});

it("P1: a free student can only open a test they have already attempted", { skip: SKIP }, async () => {
  const user = await seedStudent();
  const testId = makeId("test_p1gate");
  try {
    // A paper created while the student was still premium (or before the fix).
    await persistGeneratedCustomTest({
      id: testId,
      userId: user.id,
      subject: "physics",
      chapter: null,
      difficulty: "medium",
      title: "Physics Custom Test",
      description: "Fixture.",
      questionIds: [],
      durationMinutes: 20,
      focusTopics: [],
      generationSummary: "fixture",
      recommendedTimePerQuestionSeconds: 120,
    });

    // Never attempted → the paywall.
    await assert.rejects(getTestDetail(storeWith([]), user, testId), isPremiumRequired);

    // Attempted → history stays readable after the subscription lapses.
    const detail = await getTestDetail(storeWith([{ userId: user.id, testId }]), user, testId);
    assert.equal(detail.id, testId);
    assert.equal(detail.subject, "physics");
  } finally {
    await cleanup(user.id, [], [testId]);
  }
});

it("P1: a Physics-only buyer is refused JEE Main by the missing-subject lock, not the paywall", { skip: SKIP }, async () => {
  const user = await seedStudent();
  const evt = await grantPhysics(user.id);
  try {
    const scope = await getStudentScope(user.id, user.role);
    assert.equal(scope.premiumLocked, false);
    assert.deepEqual(scope.entitledSubjects, ["physics"]);

    await assert.rejects(
      createFullLengthTest({ userId: user.id, preset: "jee-main", scope }),
      (err: Err403) => {
        assert.ok(err instanceof PresetLockedError);
        assert.equal(err.status, 403);
        assert.deepEqual(err.missing, ["chemistry", "mathematics"]);
        return true;
      },
    );

    // An un-attempted test in an UNOWNED subject is refused too...
    const bioTest = makeId("test_p1bio");
    await persistGeneratedCustomTest({
      id: bioTest,
      userId: user.id,
      subject: "biology",
      chapter: null,
      difficulty: "medium",
      title: "Biology Custom Test",
      description: "Fixture.",
      questionIds: [],
      durationMinutes: 20,
      focusTopics: [],
      generationSummary: "fixture",
      recommendedTimePerQuestionSeconds: 120,
    });
    try {
      await assert.rejects(getTestDetail(storeWith([]), user, bioTest), (err: Err403) => {
        assert.equal(err.status, 403);
        assert.notEqual(err.code, "premium_required", "a buyer is not sent to the paywall");
        return true;
      });
      // ...while an owned subject opens normally.
      const phyTest = makeId("test_p1phy");
      await persistGeneratedCustomTest({
        id: phyTest,
        userId: user.id,
        subject: "physics",
        chapter: null,
        difficulty: "medium",
        title: "Physics Custom Test",
        description: "Fixture.",
        questionIds: [],
        durationMinutes: 20,
        focusTopics: [],
        generationSummary: "fixture",
        recommendedTimePerQuestionSeconds: 120,
      });
      try {
        const detail = await getTestDetail(storeWith([]), user, phyTest);
        assert.equal(detail.id, phyTest);
      } finally {
        await rawPool().query(`DELETE FROM analytics.custom_tests WHERE id = $1`, [phyTest]).catch(() => undefined);
      }
    } finally {
      await rawPool().query(`DELETE FROM analytics.custom_tests WHERE id = $1`, [bioTest]).catch(() => undefined);
    }
  } finally {
    await cleanup(user.id, [evt], []);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
