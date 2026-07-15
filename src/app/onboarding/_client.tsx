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
    // Navigate immediately for a snappy finish. completeOnboardingAction has
    // already persisted isOnboarded=true server-side, and /dashboard does not
    // gate on onboarding, so we don't need to wait on the network. Sync the
    // client user in the background (no await = no perceptible delay).
    router.replace('/dashboard');
    void refreshUser();
  };

  return user.role === 'teacher' ? (
    <TeacherOnboardingPage user={user} onComplete={handleComplete} />
  ) : (
    <OnboardingPage user={user} onComplete={handleComplete} />
  );
}
