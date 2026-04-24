import { cacheLife, cacheTag } from "next/cache";

import {
  getOgcodeIndexData,
  getChallengeOfTheDay,
  listGeneratedDpps,
  getOgcodeLeaderboard,
  getOgcodeSubjectRanks,
  getOgcodeUserStats,
  getPracticeQuestionDetail,
  getTestDetail,
  listOgcodeQuestionChapters,
  listOgcodeQuestionPage,
  listOgcodeQuestions,
  listTestPreviews,
  listTestResults,
  type OgcodeQuestionListFilters,
} from "@/server/assessments";
import { dbGetTasks } from "@/server/db-users";
import { buildPointsSummary } from "@/server/gamification";
import { readStore } from "@/server/store";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { buildUserStatsSnapshot, serializeTask } from "@/server/users";

function requireStoredUser(userId: string) {
  const store = readStore();
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error(`Stored user ${userId} was not found.`);
  }
  return { store, user };
}

export async function listTestsForRender(userId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('tests', `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return listTestPreviews(store, user);
}

export async function getTestDetailForRender(userId: string, testId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('tests', `test:${testId}`, `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return getTestDetail(store, user, testId);
}

export async function listTestResultsForRender(userId: string, testId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('tests', `test:${testId}`, 'progress', `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return listTestResults(store, user, testId);
}

export async function listTasksForRender(userId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('tasks', `tasks-user:${userId}`);

  if (isUserPostgresConfigured()) {
    try {
      const tasks = await dbGetTasks(userId);
      return tasks.map(serializeTask);
    } catch (error) {
      console.error(
        '[render-loaders] DB task preload failed, falling back to flat-file',
        error instanceof Error ? error.message : error,
      );
    }
  }

  const store = readStore();
  return store.tasks
    .filter((task) => task.userId === userId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map(serializeTask);
}

export async function getPointsSummaryForRender(userId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('milestones', 'progress', `progress-user:${userId}`);

  const { store } = requireStoredUser(userId);
  return buildPointsSummary(store, userId);
}

export async function getProfileStatsForRender(userId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('auth-user', `user:${userId}`, 'progress', `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return buildUserStatsSnapshot(store, user);
}

export async function getChallengeOfTheDayForRender(userId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('ogcode-challenge', `ogcode-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return getChallengeOfTheDay(store, user);
}

export type GeneratedDppForRender = Awaited<ReturnType<typeof listGeneratedDppsForRender>>[number];

export async function listGeneratedDppsForRender(userId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('progress', `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return listGeneratedDpps(store, user);
}

export async function listOgcodeQuestionsForRender(
  userId: string,
  filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
) {
  'use cache';
  cacheLife('hours');
  cacheTag('ogcode-catalog', `ogcode-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return listOgcodeQuestions(store, user, filters);
}

export async function listOgcodeQuestionPageForRender(
  userId: string,
  filters: OgcodeQuestionListFilters,
) {
  'use cache';
  cacheLife('minutes');
  cacheTag('ogcode-catalog', `ogcode-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return listOgcodeQuestionPage(store, user, filters);
}

export async function getOgcodeIndexDataForRender(
  userId: string,
  filters: OgcodeQuestionListFilters,
) {
  'use cache';
  cacheLife('minutes');
  cacheTag('ogcode-catalog', 'leaderboard', `ogcode-user:${userId}`, `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return getOgcodeIndexData(store, user, filters);
}

export async function getPracticeQuestionDetailForRender(userId: string, questionId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('ogcode-catalog', `ogcode-question:${questionId}`, `ogcode-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return getPracticeQuestionDetail(store, user, questionId);
}

export async function getOgcodeLeaderboardForRender(userId: string, subject: string | null) {
  'use cache';
  cacheLife('minutes');
  cacheTag('leaderboard', `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return getOgcodeLeaderboard(store, user, subject);
}

export async function getOgcodeUserStatsForRender(userId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('leaderboard', `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return getOgcodeUserStats(store, user);
}

export async function getOgcodeSubjectRanksForRender(userId: string) {
  'use cache';
  cacheLife('minutes');
  cacheTag('leaderboard', `progress-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return getOgcodeSubjectRanks(store, user);
}

export async function listOgcodeQuestionChaptersForRender(userId: string, subject: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('ogcode-catalog', `ogcode-user:${userId}`);

  const { store, user } = requireStoredUser(userId);
  return listOgcodeQuestionChapters(store, user, subject);
}
