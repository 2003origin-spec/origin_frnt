'use client';

import { useAuth } from '@/context/AuthContext';
import Leaderboard from '@/sections/Leaderboard';

interface LeaderboardClientProps {
  initialLeaderboard: unknown[];
  initialMyRank: number | null;
}

export default function LeaderboardClient({ initialLeaderboard, initialMyRank }: LeaderboardClientProps) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Leaderboard
      currentUser={user}
      initialLeaderboard={initialLeaderboard}
      initialMyRank={initialMyRank}
    />
  );
}
