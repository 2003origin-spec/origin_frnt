import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';

/**
 * Server-side auth guard for every /admin/* route. The cookie read lives
 * inside a Suspense boundary so the static shell can be prerendered under
 * `cacheComponents: true`.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/auth?next=/admin');
  if (user.role !== 'admin') redirect('/dashboard');
  return <>{children}</>;
}
