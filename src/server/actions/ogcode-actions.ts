'use server';

import { revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { readStore } from '@/server/store';
import {
  submitPracticeQuestion,
  type PracticeSubmissionPayload,
} from '@/server/assessments';

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

export async function submitOgcodeAnswerAction(
  questionId: string,
  payload: PracticeSubmissionPayload,
) {
  const user = await requireUser();
  const store = readStore();
  const result = await submitPracticeQuestion(store, user, questionId, payload);

  revalidateTag('leaderboard', 'max');
  revalidateTag('milestones', 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  revalidateTag(`ogcode-question:${questionId}`, 'max');
  revalidateTag('ogcode-catalog', 'max');
  revalidateTag(`ogcode-user:${user.id}`, 'max');
  revalidateTag('ogcode-challenge', 'max');
  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${user.id}`, 'max');
  return result;
}
