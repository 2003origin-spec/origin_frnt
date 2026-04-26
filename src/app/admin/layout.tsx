import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';

/**
 * Server-side auth guard for every /admin/* route. The cookie read lives
 * inside a Suspense boundary so the static shell can be prerendered under
 * `cacheComponents: true`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  if (!user || user.role !== 'admin') {
    redirect('/auth?role=admin');
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      {children}
    </Suspense>
  );
}
