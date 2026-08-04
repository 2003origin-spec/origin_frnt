export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import AdminLayout from "@/components/layout/AdminLayout";
import { AdminCbtTeachers } from "@/components/admin/AdminCbtTeachers";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { getCbtUsageStats, listCbtTeachers } from "@/server/cbt/cbt-teachers-service";

/**
 * Admin → CBT: manage the CBT teacher allowlist. Dark behind cbtModule
 * (404 when off); admin-only (mirrors the other /admin pages).
 */
export default async function AdminCbtPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/admin/cbt");
  if (user.role !== "admin") redirect("/dashboard");

  const [teachers, stats] = await Promise.all([listCbtTeachers(), getCbtUsageStats()]);

  return (
    <AdminLayout>
      <AdminCbtTeachers
        initialTeachers={teachers}
        initialStats={stats}
        reportCardsAvailable={isFeatureEnabled("cbtReportCards")}
      />
    </AdminLayout>
  );
}
