'use client';

import Profile from '@/sections/Profile';
import TeacherProfile from '@/sections/TeacherProfile';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, streakData, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  if (user.role === 'teacher') {
    return (
      <TeacherProfile
        user={user}
        onBack={() => router.back()}
        onLogout={logout}
      />
    );
  }

  return (
    <Profile
      user={user}
      streakData={streakData}
      onBack={() => router.back()}
      onUpgrade={() => router.push('/premium')}
    />
  );
}
