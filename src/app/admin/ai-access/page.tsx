/**
 * /admin/ai-access — AI Feature Toggle admin console (RSC shell).
 *
 * The admin layout (src/app/admin/layout.tsx) already enforces the admin role
 * and wraps <AdminLayout>, so this page renders only its own content. It
 * server-fetches the overview (service call, not HTTP) and hands it to the
 * client panel. Gated on aiAccessControls.
 *
 * Design: V1/ai-feature-toggle/05-admin-ui.md.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getAiAccessOverview } from "@/server/ai-access-service";
import AdminAiAccessPanel from "@/components/admin/AdminAiAccessPanel";

export const dynamic = "force-dynamic";

export default async function AdminAiAccessPage() {
  if (!isFeatureEnabled("aiAccessControls")) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          AI Access controls are disabled in this environment.
        </div>
      </div>
    );
  }
  const initialOverview = await getAiAccessOverview();
  return <AdminAiAccessPanel initialOverview={initialOverview} />;
}
