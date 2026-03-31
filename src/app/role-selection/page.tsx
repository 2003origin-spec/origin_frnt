'use client';

import RoleSelection from '@/sections/RoleSelection';
import { useRouter } from 'next/navigation';

export default function RoleSelectionPage() {
  const router = useRouter();

  return (
    <RoleSelection
      onSelectRole={(role) => {
        router.push(`/auth?role=${role}`);
      }}
      onBack={() => router.back()}
    />
  );
}
