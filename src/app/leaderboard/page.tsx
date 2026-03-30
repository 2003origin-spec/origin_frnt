'use client';

import Leaderboard from '@/sections/Leaderboard';
import { useAuth } from '@/context/AuthContext';

export default function LeaderboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Leaderboard
      currentUser={user}
    />
  );
}
