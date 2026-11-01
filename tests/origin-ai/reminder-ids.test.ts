/**
 * Ori reminder ids are unique per student.
 *
 * `buildReminders` used to derive ids from the source alone
 * (`reminder_dpp_<dppId>`, `reminder_revision_<topic>`, ...), so two students
 * with the same pending DPP or the same weak topic produced the SAME reminder
 * id and the per-user scoped upsert could land on another student's row.
 * Every generated id now embeds the user id; this pins that for every kind.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildReminders } from "@/legacy/origin-ai";
import type { OriginAiAnalyticsSnapshot } from "@/server/analytics-store";
import {
  resetStore,
  withStoredUserDefaults,
  type AppStore,
  type StoredAssignment,
  type StoredDpp,
  type StoredTestResult,
  type StoredUser,
} from "@/server/store";

const NOW = new Date(0).toISOString();

function buildUser(id: string): StoredUser {
  return withStoredUserDefaults({
    id,
    name: `Student ${id}`,
    email: `${id}@example.com`,
    password: "",
    role: "student",
    studentClass: "12",
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 3,
    totalStudyTime: 0,
    joinedAt: NOW,
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: true,
    selectedCourse: "jee",
    isDropper: false,
    yearsOfExperience: null,
    subjects: [],
    studentCapacity: null,
  });
}

/** Identical pending work for a user — same source ids, same topics. */
function seedSharedWork(store: AppStore, userId: string) {
  const dpp: StoredDpp = {
    id: "dpp_shared_kinematics",
    userId,
    title: "Kinematics DPP",
    subject: "physics",
    questionIds: [],
    generatedFrom: [],
    completed: false,
    createdAt: NOW,
  };
  const assignment: StoredAssignment = {
    id: "assignment_shared_optics",
    userId,
    title: "Optics worksheet",
    subject: "physics",
    questionIds: [],
    completed: false,
    dueDate: null,
    createdAt: NOW,
  };
  store.dpps.push(dpp);
  store.assignments.push(assignment);
}

function latestResult(userId: string): StoredTestResult {
  return {
    id: "result_shared",
    userId,
    testId: "test_shared",
    score: 10,
    percentage: 25,
    correctAnswers: 1,
    wrongAnswers: 3,
    unattempted: 0,
    timeTaken: 60,
    weakAreas: [{ topic: "Rotational Motion", accuracy: 20 }],
    strongAreas: [],
    aiAnalysis: { summary: "", mistakes: [], recommendations: [], dppGenerated: false },
    subjectStats: {},
    isMalpractice: false,
    createdAt: NOW,
    answers: [],
  };
}

const analytics: OriginAiAnalyticsSnapshot = {
  latestWeakTopics: ["Thermodynamics"],
  latestStrongTopics: [],
  latestTestSummary: null,
  pendingDppCount: 1,
  pendingDppFocusTopics: ["Thermodynamics"],
  recentDppProgressSummary: null,
};

/** Builds every reminder kind for one user: dpp + revision + assignment +
 * habit from the store, then dpp_focus (only emitted when no DPP is pending). */
function allRemindersFor(store: AppStore, user: StoredUser) {
  const fromStore = buildReminders(store, user, latestResult(user.id), null);
  const emptyStore: AppStore = { ...store, dpps: [], assignments: [] };
  // The habit reminder is emitted on every call; keep the first copy only.
  const fromAnalytics = buildReminders(emptyStore, user, null, analytics).filter((entry) => entry.kind !== "habit");
  return [...fromStore, ...fromAnalytics];
}

test("every reminder kind embeds the student id in its id", () => {
  const store = resetStore();
  const user = buildUser("user_alpha");
  seedSharedWork(store, user.id);

  const reminders = allRemindersFor(store, user);
  const kinds = new Set(reminders.map((entry) => entry.kind));
  assert.deepEqual([...kinds].sort(), ["assignment", "dpp", "habit", "revision"]);
  assert.ok(reminders.some((entry) => entry.id.startsWith("reminder_dpp_focus_")), "dpp_focus reminder emitted");
  assert.ok(reminders.some((entry) => entry.id.startsWith("reminder_revision_")), "revision reminder emitted");

  for (const reminder of reminders) {
    assert.ok(reminder.id.includes(user.id), `${reminder.kind} id "${reminder.id}" must contain the user id`);
    assert.equal(reminder.userId, user.id);
  }
  assert.equal(new Set(reminders.map((entry) => entry.id)).size, reminders.length, "ids unique within one user");
});

test("two students with the same pending DPP, assignment and topics get disjoint ids", () => {
  const store = resetStore();
  const alpha = buildUser("user_alpha");
  const beta = buildUser("user_beta");
  seedSharedWork(store, alpha.id);
  seedSharedWork(store, beta.id);

  const alphaIds = new Set(allRemindersFor(store, alpha).map((entry) => entry.id));
  const betaIds = new Set(allRemindersFor(store, beta).map((entry) => entry.id));
  assert.ok(alphaIds.size >= 5, "alpha produced every kind");
  assert.equal(alphaIds.size, betaIds.size, "same work → same number of reminders");

  const shared = [...alphaIds].filter((id) => betaIds.has(id));
  assert.deepEqual(shared, [], `reminder ids must not collide across students: ${shared.join(", ")}`);
});
