'use server';

import { getServerUser } from '@/lib/auth-server';
import { getContestStatus, getOpenContests, type ContestStatus, type ContestSummary } from '@/server/contest/contest-status';
import { registerForContest, type RegistrationResult } from '@/server/contest/contest-registration-service';
import { requireFeatureEnabled } from '@/lib/feature-flags';

/**
 * Contest banner status for the (client-only) landing page + any client surface.
 * Resolves the optional viewer server-side, so a logged-out visitor gets the
 * public snapshot (isRegistered:false). Safe to call from a client component.
 */
export async function getContestStatusAction(): Promise<ContestStatus> {
  const user = await getServerUser().catch(() => null);
  return getContestStatus(user?.id ?? null);
}

/** ALL currently-available contests (live/upcoming) for the "see all" list. */
export async function getOpenContestsAction(): Promise<ContestSummary[]> {
  const user = await getServerUser().catch(() => null);
  return getOpenContests(user?.id ?? null);
}

/**
 * Register the current user for a contest from a client surface (the banner CTA).
 * Requires auth; window-checked + idempotent server-side.
 */
export async function registerForContestAction(contestId: string): Promise<RegistrationResult> {
  requireFeatureEnabled('contest');
  const user = await getServerUser();
  if (!user) throw new Error('Please sign in to register.');
  const result = await registerForContest(contestId, user.id);
  // Fire the registration-confirmation notification for a NEW registration
  // (best-effort; idempotent via the reminders ledger).
  if (!result.alreadyRegistered) {
    const { getContest } = await import('@/server/contest/contest-admin-service');
    const { sendRegistrationConfirmation } = await import('@/server/contest/contest-reminders-service');
    void getContest(contestId)
      .then((c) => (c ? sendRegistrationConfirmation(contestId, c.name, user.id) : undefined))
      .catch(() => undefined);
  }
  return result;
}
