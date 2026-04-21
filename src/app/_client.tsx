'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import LandingPage from '@/sections/LandingPage';

export default function HomeClient() {
  const { user } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (user) {
      router.push(user.isOnboarded ? '/dashboard' : '/onboarding');
    } else {
      router.push('/role-selection');
    }
  };

  return (
    <main className="relative min-h-screen">
      <LandingPage onGetStarted={handleGetStarted} />
    </main>
  );
}
