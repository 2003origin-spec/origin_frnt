'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import LandingPage from '@/sections/LandingPage';

export default function HomeClient() {
  const { user } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (!user) {
      router.push('/role-selection');
      return;
    }
    // Route by role first; /dashboard is the student-only home.
    if (user.role === 'teacher') {
      router.push('/teacher');
      return;
    }
    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    router.push(user.isOnboarded ? '/dashboard' : '/onboarding');
  };

  // No intro video / splash gate — render the landing content immediately.
  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <LandingPage onGetStarted={handleGetStarted} />
    </main>
  );
}
