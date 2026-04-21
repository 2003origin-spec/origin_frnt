import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { readStore } from '@/server/store';
import { getOgcodeLeaderboard } from '@/server/assessments';
import LeaderboardClient from './_client';

export default async function LeaderboardPage() {
  const serverUser = await getServerUser();
  if (!serverUser) redirect('/auth?next=/leaderboard');

  let initialLeaderboard: unknown[] = [];
  let initialMyRank: number | null = null;

  try {
    const store = readStore();
    const data = await getOgcodeLeaderboard(store, serverUser, null);
    initialLeaderboard = data.leaderboard;
    initialMyRank = data.myRank;
  } catch {
    // Leaderboard will fetch client-side on mount
  }

  return (
    <LeaderboardClient
      initialLeaderboard={initialLeaderboard}
      initialMyRank={initialMyRank}
    />
  );
}
