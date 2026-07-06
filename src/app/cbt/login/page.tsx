import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { CbtLoginCard } from '@/components/cbt/CbtLoginCard';

/**
 * CBT teacher OTP login. Public page so allowlisted teachers can reach it
 * without a session. noindex — this surface is not for search engines.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function CbtLoginPage() {
  if (!isFeatureEnabled('cbtModule')) notFound();

  // An already-signed-in CBT teacher skips the form.
  const user = await getServerUser();
  if (user?.role === 'cbt_teacher') redirect('/cbt');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <CbtLoginCard />
    </main>
  );
}
