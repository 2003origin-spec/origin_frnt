import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import {
  getChallengeOfTheDayForRender,
  getPointsSummaryForRender,
  listTasksForRender,
} from '@/server/render-loaders';
import { getRegistrationStatus } from '@/server/users';
import { getContestStatus, type ContestStatus } from '@/server/contest/contest-status';
import { recordDailyLoginStreak, type StreakTouchResult } from '@/server/streak-login';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { istDateKey } from '@/lib/ist-day';
import type { Task } from '@/types';

type RegistrationStatus = { count: number; limit: number; seatsLeft: number };
import DashboardClient from './_client';
import DashboardLoading from './loading';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardGate />
    </Suspense>
  );
}

async function DashboardGate() {
  const user = await getServerUser();
  if (!user) redirect('/');
  // /dashboard is the student home. Teachers and admins must never see it —
  // the teacher app lives entirely under /teacher. This is a hard server-side
  // guard so even if a stale redirect or hand-typed URL lands a teacher
  // here, we bounce them to the correct app before any data loads.
  if (user.role === 'teacher') redirect('/teacher');
  if (user.role === 'admin') redirect('/admin');

  let initialTasks: Task[] = [];
  let initialPointsData: Awaited<ReturnType<typeof getPointsSummaryForRender>> | null = null;
  let initialChallenge: Awaited<ReturnType<typeof getChallengeOfTheDayForRender>> | null = null;
  let initialRegStatus: RegistrationStatus | null = null;
  let initialContest: ContestStatus | null = null;
  let initialStreakCelebration: StreakTouchResult | null = null;

  // First login of the (IST) day advances the streak and decides whether the
  // flame celebration fires — server-authoritative, at most once per day. The
  // touch mutates the store, so it must run on load (no-ops after the first
  // load of the day). Gated dark until the overlay UI ships.
  const streakEnabled = isFeatureEnabled('loginStreakCelebration');

  const [tasksResult, pointsResult, challengeResult, regResult, contestResult, streakResult] = await Promise.allSettled([
    listTasksForRender(user.id),
    getPointsSummaryForRender(user.id),
    getChallengeOfTheDayForRender(istDateKey(), user.id),
    getRegistrationStatus(user.role),
    getContestStatus(user.id),
    streakEnabled ? recordDailyLoginStreak(user.id) : Promise.resolve(null),
  ]);

  if (tasksResult.status === 'fulfilled') {
    initialTasks = (tasksResult.value ?? []) as unknown as Task[];
  }
  if (pointsResult.status === 'fulfilled') {
    initialPointsData = pointsResult.value;
  }
  if (challengeResult.status === 'fulfilled') {
    initialChallenge = challengeResult.value;
  }
  if (regResult.status === 'fulfilled') {
    initialRegStatus = regResult.value;
  }
  if (contestResult.status === 'fulfilled') {
    initialContest = contestResult.value;
  }
  if (streakResult.status === 'fulfilled') {
    initialStreakCelebration = streakResult.value;
  }

  return (
    <DashboardClient
      initialChallenge={initialChallenge}
      initialPointsData={initialPointsData}
      initialTasks={initialTasks}
      initialRegStatus={initialRegStatus}
      initialContest={initialContest}
      initialStreakCelebration={initialStreakCelebration}
    />
  );
}
