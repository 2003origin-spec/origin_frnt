export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { AdminCodeRequestsPanel } from "@/components/admin/AdminCodeRequestsPanel";

/**
 * /admin/teacher-code-requests — Feature A admin console (RSC shell). The /admin
 * tree is already admin-role-gated by middleware; this only adds the feature-flag
 * gate. When teacherCodeApproval (or adminControlCenter) is off, 404.
 */
export default function TeacherCodeRequestsPage() {
  if (!isFeatureEnabled("adminControlCenter") || !isFeatureEnabled("teacherCodeApproval")) {
    notFound();
  }
  return <AdminCodeRequestsPanel />;
}
