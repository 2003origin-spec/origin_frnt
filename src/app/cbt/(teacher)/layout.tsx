import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { CbtShell } from '@/components/cbt/CbtShell';
import type { CbtQuotaClientState } from '@/components/cbt/quota-client';
import { findActiveCbtTeacherByUserId } from '@/server/cbt/cbt-teachers-service';
import { getCbtQuotaState } from '@/server/cbt/cbt-quota-service';

/**
 * Server-side guard for the CBT teacher app. Wraps every /cbt/** route EXCEPT
 * the public `/cbt/login` and `/cbt/r/**` student pages, which live outside
 * this `(teacher)` route group and so do not inherit this guard.
 *
 * The whole surface ships dark: when `cbtModule` is off the tree 404s. When on,
 * only a `cbt_teacher` session may enter — everyone else is bounced to login.
 * (Middleware already enforces the same role gate at the edge; this is
 * defence-in-depth for the server-rendered tree.)
 *
 * It also seeds the navbar's participation meter, so the number is correct on
 * first paint instead of popping in after a client fetch.
 */
export default async function CbtTeacherLayout({ children }: { children: React.ReactNode }) {
  if (!isFeatureEnabled('cbtModule')) notFound();

  const user = await getServerUser();
  if (!user || user.role !== 'cbt_teacher') {
    redirect('/cbt/login');
  }

  const quota = await loadQuota(user.id);

  return (
    <CbtShell teacherName={user.name} quota={quota}>
      {children}
    </CbtShell>
  );
}

/**
 * Best-effort quota read for the meter. A failure here must never 500 the whole
 * teacher app — the meter simply doesn't render, and every enforcement decision
 * is made server-side at the point of action anyway.
 */
async function loadQuota(userId: string): Promise<CbtQuotaClientState | null> {
  if (!isFeatureEnabled('cbtParticipationQuota')) return null;
  try {
    const teacher = await findActiveCbtTeacherByUserId(userId);
    if (!teacher) return null;
    return await getCbtQuotaState(teacher.id);
  } catch (error) {
    console.error('[cbt] quota meter load failed', error instanceof Error ? error.message : error);
    return null;
  }
}
