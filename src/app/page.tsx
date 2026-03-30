'use client';

import LandingPage from '@/sections/LandingPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/role-selection');
    }
  };

  return <LandingPage onGetStarted={handleGetStarted} />;
}
