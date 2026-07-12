'use server';

import { revalidateTag, revalidatePath } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { withStoreAsyncScoped, PRACTICE_SUBMIT_PERSIST_COLLECTIONS } from '@/server/store';
import {
  submitPracticeQuestion,
  type PracticeSubmissionPayload,
} from '@/server/assessments';
import { getOgcodeCatalogQuestionById, getOgcodeCatalogQuestionMap } from '@/server/ogcode-catalog';
import { getUserPostgresPool } from '@/server/user-postgres';
import { markOgcodeRevealed } from '@/server/ogcode-progress';
import { toggleOgcodeQuestionLike } from '@/server/ogcode-likes';
import {
  submitOgcodeQuestionReport,
  isOgcodeReportReason,
} from '@/server/ogcode-reports';
import {
  recordOgcodePresence,
  getOgcodePresenceCount,
  getOgcodePresenceCounts,
} from '@/server/ogcode-presence';
import {
  createOgcodeChallenge,
  listOgcodeChallengeInbox,
  countOgcodePendingChallenges,
  type OgcodeChallenge,
} from '@/server/ogcode-challenges';
import { areMutualFollowers, listMutualFollowers, type SocialUserCard } from '@/server/social/social-service';

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

/**
 * §10 Liked Questions toggle. user_id is taken ONLY from the verified session,
 * never the payload. Returns the new public count + this user's liked flag.
 * Rate limiting is covered by the global mutation limiter in middleware.
 */
export async function toggleOgcodeQuestionLikeAction(
  questionId: string,
): Promise<{ count: number; likedByMe: boolean }> {
  const user = await requireUser();
  const result = await toggleOgcodeQuestionLike(user.id, questionId);
  revalidateTag(`ogcode-question:${questionId}`, 'max');
  return result;
}

/**
 * §11 Report Question — store-only. user_id from the verified session; reason
 * validated against the allow-list. Global mutation limiter covers it.
 */
export async function reportOgcodeQuestionAction(
  questionId: string,
  reason: string,
  description: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!isOgcodeReportReason(reason)) {
    return { ok: false, error: 'invalid_reason' };
  }
  const result = await submitOgcodeQuestionReport(user.id, questionId, reason, description);
  return { ok: result.ok };
}

/**
 * §12 Live Practicing — record this user's heartbeat on a question and return
 * the current live count. Called on a ~15s interval while the question is open.
 */
export async function ogcodePresenceHeartbeatAction(questionId: string): Promise<{ count: number }> {
  const user = await requireUser();
  await recordOgcodePresence(user.id, questionId);
  const count = await getOgcodePresenceCount(questionId);
  return { count };
}

/** §12 Read the live count for a single question without a heartbeat. */
export async function ogcodePresenceCountAction(questionId: string): Promise<{ count: number }> {
  await requireUser();
  return { count: await getOgcodePresenceCount(questionId) };
}

/** §12 Batch live counts for the visible list cards. */
export async function ogcodePresenceCountsAction(questionIds: string[]): Promise<Record<string, number>> {
  await requireUser();
  const map = await getOgcodePresenceCounts(questionIds);
  return Object.fromEntries(map);
}

/**
 * §13 Friend Challenge — mutual-follow share-sheet search. Only students who
 * both follow and are followed by the caller are challengeable.
 */
export async function listOgcodeChallengeMutualsAction(query: string): Promise<SocialUserCard[]> {
  const user = await requireUser();
  return listMutualFollowers(user.id, query ?? '', 20);
}

/**
 * §13 Send a challenge to a mutual follower. Rejects non-mutuals server-side
 * (the client only shows mutuals, but the guard is authoritative here).
 */
export async function sendOgcodeChallengeAction(
  questionId: string,
  toUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (toUserId === user.id) {
    return { ok: false, error: 'self' };
  }
  const mutual = await areMutualFollowers(user.id, toUserId);
  if (!mutual) {
    return { ok: false, error: 'not_mutual' };
  }
  const { created } = await createOgcodeChallenge(user.id, toUserId, questionId);
  return { ok: created, error: created ? undefined : 'already_pending' };
}

export type HydratedChallenge = OgcodeChallenge & {
  fromName: string;
  fromUsername: string | null;
  fromAvatar: string | null;
  questionText: string;
  questionSubject: string | null;
};

/**
 * §13 The recipient's "OG Friend Challenge Box" — inbox + pending count.
 * Hydrates sender identity (USER pool) and question text (OGCODE pool) so the
 * box renders without extra client round-trips.
 */
export async function listOgcodeChallengeInboxAction(): Promise<{
  challenges: HydratedChallenge[];
  pending: number;
}> {
  const user = await requireUser();
  const [raw, pending] = await Promise.all([
    listOgcodeChallengeInbox(user.id),
    countOgcodePendingChallenges(user.id),
  ]);
  if (!raw.length) return { challenges: [], pending };

  // Batch-resolve senders (USER pool) and questions (OGCODE pool).
  const senderIds = [...new Set(raw.map((c) => c.fromUserId))];
  const questionIds = [...new Set(raw.map((c) => c.questionId))];
  const senders = new Map<string, { name: string; username: string | null; avatar: string | null }>();
  try {
    const userPool = getUserPostgresPool();
    if (userPool && senderIds.length) {
      const res = await userPool.query<{ id: string; name: string; username: string | null; avatar: string | null }>(
        `SELECT id, name, username, avatar FROM origin_users WHERE id = ANY($1::text[])`,
        [senderIds],
      );
      for (const row of res.rows) {
        senders.set(row.id, { name: row.name, username: row.username, avatar: row.avatar });
      }
    }
  } catch {
    // Fall back to ids if the lookup fails.
  }
  const questions = await getOgcodeCatalogQuestionMap(questionIds).catch(() => new Map());

  const challenges: HydratedChallenge[] = raw.map((c) => {
    const s = senders.get(c.fromUserId);
    const q = questions.get(c.questionId);
    return {
      ...c,
      fromName: s?.name ?? 'A friend',
      fromUsername: s?.username ?? null,
      fromAvatar: s?.avatar ?? null,
      questionText: q?.text ? String(q.text).slice(0, 140) : 'Question',
      questionSubject: q?.subject ?? null,
    };
  });
  return { challenges, pending };
}

export async function submitOgcodeAnswerAction(
  questionId: string,
  payload: PracticeSubmissionPayload,
) {
  const user = await requireUser();
  const result = await withStoreAsyncScoped(
    async (store) => {
      return submitPracticeQuestion(store, user, questionId, payload);
    },
    { userId: user.id, collections: PRACTICE_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
  );

  revalidateTag('leaderboard', 'max');
  revalidateTag('milestones', 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  revalidateTag(`ogcode-question:${questionId}`, 'max');
  revalidateTag('ogcode-catalog', 'max');
  revalidateTag('user-stats', 'max');
  revalidatePath('/ogcode', 'page');
  revalidatePath(`/ogcode/${questionId}`, 'page');
  return result;
}

export type RevealOgcodeQuestionResult =
  | { enabled: false }
  | {
      enabled: true;
      kind: 'hint' | 'answer';
      /** True when this call applied the score decay (set-once; repeats are no-ops). */
      firstReveal: boolean;
      hint: string | null;
      /** Only present for kind === 'answer'. Text-based on purpose: the client
       *  renders options SHUFFLED (presentOptions), so canonical indices would
       *  highlight the wrong displayed option. */
      correctAnswerText?: string | null;
      explanation?: string | null;
      matrixPairs?: number[][] | null;
    };

/**
 * OGCode Scoring V2 reveal endpoint (V1/OGCODE_SCORING_ALGORITHM.md, Phase 4).
 * The single reveal implementation lives in ogcode-progress.markOgcodeRevealed;
 * its three triggers are: this action with kind 'hint', this action with kind
 * 'answer', and cap-exhaustion inside the submit flow. First reveal persists
 * Attempted=true + the decay flag (hint → bs/2, answer → bs=0); repeats are
 * idempotent and never re-decay.
 *
 * Flag off ⇒ { enabled: false } with no persistence and, critically, no answer
 * content — legacy mode has no decay to pay for a reveal, so exposing the
 * answer here would be a free answer-leak endpoint.
 */
export async function revealOgcodeQuestionAction(
  questionId: string,
  kind: 'hint' | 'answer',
): Promise<RevealOgcodeQuestionResult> {
  const user = await requireUser();
  if (!isFeatureEnabled('ogcodeScoringV2')) {
    return { enabled: false };
  }

  // V2 reveal only covers catalog questions (store fixtures keep legacy behavior).
  const question = await getOgcodeCatalogQuestionById(questionId);
  if (!question) {
    return { enabled: false };
  }

  const { firstReveal } = await markOgcodeRevealed(user.id, question.id, kind);

  revalidateTag(`ogcode-question:${questionId}`, 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');

  if (kind === 'hint') {
    return { enabled: true, kind, firstReveal, hint: question.hint ?? null };
  }

  const optionText = (index: number | null | undefined): string | null =>
    index != null && question.options?.[index] != null ? question.options[index] : null;
  const correctAnswerText =
    question.answerText ??
    (question.questionType === 'msq' && question.correctOptions?.length
      ? question.correctOptions.map((index) => optionText(index)).filter(Boolean).join(' · ')
      : optionText(question.correctOption));

  return {
    enabled: true,
    kind,
    firstReveal,
    hint: question.hint ?? null,
    correctAnswerText,
    explanation: question.explanation ?? null,
    matrixPairs: question.questionType === 'matrix_match' ? question.matrixData?.correct_pairs ?? null : null,
  };
}
