'use client';

import AuthPage from '@/sections/AuthPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Auth() {
  const { user, userRole, login, isLoading, authError } = useAuth();
  const router = useRouter();

  return (
    <AuthPage
      userRole={user ? user.role : userRole}
      onLogin={login}
      onBack={() => router.back()}
      isLoading={isLoading}
      error={authError}
    />
  );
}
