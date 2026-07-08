import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerFrontendUser } from '@/lib/auth-server';
import { shouldRedirectFreeStudent } from '@/server/entitlements';
import { resolveAiAccessForUser } from '@/server/ai-access';
import AiDisabledNotice from '@/components/origin-ai/AiDisabledNotice';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import DoubtSolverClient from './_client';

export default function DoubtSolverPage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <DoubtSolverGate />
    </Suspense>
  );
}

async function DoubtSolverGate() {
  const user = await getServerFrontendUser();
  if (!user) redirect('/');
  // AI Explainer / Doubt Solver is a global-unlock premium feature (Phase 1.4).
  if (shouldRedirectFreeStudent(user)) redirect('/premium');
  // AI Feature Toggle epic — admin/institute/global toggle can disable the
  // Explainer for this student (and non-students are role-denied). Render an
  // in-place notice rather than redirect, to avoid loops (doc 04 §2.2).
  const access = await resolveAiAccessForUser({ id: user.id, role: user.role });
  if (!access.aiExplainer) return <AiDisabledNotice />;
  return <DoubtSolverClient />;
}
