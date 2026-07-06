import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { CbtShell } from '@/components/cbt/CbtShell';

/**
 * Server-side guard for the CBT teacher app. Wraps every /cbt/** route EXCEPT
 * the public `/cbt/login` and `/cbt/r/**` student pages, which live outside
 * this `(teacher)` route group and so do not inherit this guard.
 *
 * The whole surface ships dark: when `cbtModule` is off the tree 404s. When on,
 * only a `cbt_teacher` session may enter — everyone else is bounced to login.
 * (Middleware already enforces the same role gate at the edge; this is
 * defence-in-depth for the server-rendered tree.)
 */
export default async function CbtTeacherLayout({ children }: { children: React.ReactNode }) {
  if (!isFeatureEnabled('cbtModule')) notFound();

  const user = await getServerUser();
  if (!user || user.role !== 'cbt_teacher') {
    redirect('/cbt/login');
  }

  return <CbtShell teacherName={user.name}>{children}</CbtShell>;
}
