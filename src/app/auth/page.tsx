'use client';

import { Suspense } from 'react';
import AuthPage from '@/sections/AuthPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleOAuthProvider } from '@react-oauth/google';

function AuthPageContent() {
  const { user, userRole, login, register, googleLogin, isLoading, authError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get('role');
  const selectedRole =
    requestedRole === 'student' || requestedRole === 'teacher'
      ? requestedRole
      : null;

  return (
    <AuthPage
      userRole={
        user
          ? user.role === 'student' || user.role === 'teacher'
            ? user.role
            : null
          : selectedRole ?? userRole
      }
      onLogin={login}
      onRegister={register}
      onGoogleLogin={googleLogin}
      onBack={() => router.back()}
      isLoading={isLoading}
      error={authError}
    />
  );
}

export default function Auth() {
  return (
    <Suspense fallback={null}>
      <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'}>
        <AuthPageContent />
      </GoogleOAuthProvider>
    </Suspense>
  );
}
