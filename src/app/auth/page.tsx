'use client';

import { Suspense } from 'react';
import AuthPage from '@/sections/AuthPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthPageContent() {
  const { user, userRole, login, isLoading, authError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get('role');
  const selectedRole =
    requestedRole === 'student' || requestedRole === 'teacher'
      ? requestedRole
      : null;

  return (
    <AuthPage
      userRole={user ? user.role : selectedRole ?? userRole}
      onLogin={login}
      onBack={() => router.back()}
      isLoading={isLoading}
      error={authError}
    />
  );
}

export default function Auth() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
