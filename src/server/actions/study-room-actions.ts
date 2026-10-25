'use server';

import { revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { publishRoomEvent } from '@/server/rooms-pubsub';
import { submitRoomTest } from '@/server/study-rooms';
import { TEST_SUBMIT_PERSIST_COLLECTIONS, withStoreAsyncScoped } from '@/server/store';
import type { TestSubmissionPayload } from '@/server/assessments';

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

export async function submitRoomTestAction(roomId: string, payload: TestSubmissionPayload) {
  const user = await requireUser();
  // Same scoped persist as a regular test submit: the result is written by
  // persistTestAnalysisResult, only the gamification side-effects live in the
  // store (and the user row for streak/study time).
  const { result, finish } = await withStoreAsyncScoped(
    (store) => submitRoomTest(store, user, roomId, payload),
    { userId: user.id, collections: TEST_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
  );

  await publishRoomEvent(roomId, {
    type: 'participant_finished',
    user_id: user.id,
    rank: finish.rank,
  });
  if (finish.ended_at) {
    await publishRoomEvent(roomId, { type: 'test_ended', ended_at: finish.ended_at });
  }

  revalidateTag('tests', 'max');
  revalidateTag('leaderboard', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  revalidateTag('progress', 'max');
  revalidateTag('ogcode-catalog', 'max');
  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${user.id}`, 'max');

  return result;
}
