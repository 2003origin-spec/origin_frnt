'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import LandingPage from '@/sections/LandingPage';
import { motion } from 'framer-motion';

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

  // The app-start intro video was removed — open straight to the landing/content.
  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <motion.div
        key="content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <LandingPage onGetStarted={handleGetStarted} />
      </motion.div>
    </main>
  );
}
