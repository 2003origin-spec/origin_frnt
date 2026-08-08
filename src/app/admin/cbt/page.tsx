export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import AdminLayout from "@/components/layout/AdminLayout";
import { AdminCbtTeachers } from "@/components/admin/AdminCbtTeachers";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { getCbtUsageStats, listCbtTeachers } from "@/server/cbt/cbt-teachers-service";
import { getCbtQuotaOverview, type CbtQuotaOverview } from "@/server/cbt/cbt-quota-admin-service";

/**
 * Admin → CBT: manage the CBT teacher allowlist. Dark behind cbtModule
 * (404 when off); admin-only (mirrors the other /admin pages).
 */
export default async function AdminCbtPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/admin/cbt");
  if (user.role !== "admin") redirect("/dashboard");

  const [teachers, stats, quota] = await Promise.all([
    listCbtTeachers(),
    getCbtUsageStats(),
    loadQuotaOverview(),
  ]);

  return (
    <AdminLayout>
      <AdminCbtTeachers
        initialTeachers={teachers}
        initialStats={stats}
        reportCardsAvailable={isFeatureEnabled("cbtReportCards")}
        initialQuota={quota}
      />
    </AdminLayout>
  );
}

/** Best-effort: a quota read failure must not take down the CBT admin page. */
async function loadQuotaOverview(): Promise<CbtQuotaOverview | null> {
  if (!isFeatureEnabled("cbtParticipationQuota")) return null;
  try {
    return await getCbtQuotaOverview();
  } catch (error) {
    console.error("[admin/cbt] quota overview load failed", error instanceof Error ? error.message : error);
    return null;
  }
}
