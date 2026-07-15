'use client';

import OnboardingPage from '@/sections/OnboardingPage';
import TeacherOnboardingPage from '@/sections/TeacherOnboardingPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function OnboardingClient() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleComplete = async () => {
    // Await the refresh so the client user state is guaranteed onboarded
    // (isOnboarded=true) BEFORE we navigate. Navigating first left a window
    // where the stale user (isOnboarded=false) could trip the guest-path guard
    // and bounce the user back to onboarding / the landing page (the old loop).
    await refreshUser();
    router.replace('/dashboard');
  };

  return user.role === 'teacher' ? (
    <TeacherOnboardingPage user={user} onComplete={handleComplete} />
  ) : (
    <OnboardingPage user={user} onComplete={handleComplete} />
  );
}
