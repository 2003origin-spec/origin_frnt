'use client';

import RoleSelection from '@/sections/RoleSelection';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RoleSelectionPage() {
  const router = useRouter();
  const { userRole } = useAuth(); // Assuming we might want to pre-select or something

  return (
    <RoleSelection
      onSelectRole={(role) => {
        // In the original App.tsx, it sets userRole and goes to auth
        // We can handle this via state or query params if needed, but for now just push to auth
        router.push('/auth');
      }}
      onBack={() => router.back()}
    />
  );
}
