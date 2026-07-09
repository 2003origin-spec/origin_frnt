/**
 * /admin/premium-access — Premium Pro access admin console (RSC shell).
 *
 * The admin layout (src/app/admin/layout.tsx) already enforces the admin role, so
 * this page renders only its own content. It server-fetches the overview (service
 * call, not HTTP) and hands it to the client panel. Gated on adminPremiumAccess.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getPremiumAccessOverview } from "@/server/premium-access-admin-service";
import AdminPremiumAccessPanel from "@/components/admin/AdminPremiumAccessPanel";

export const dynamic = "force-dynamic";

export default async function AdminPremiumAccessPage() {
  if (!isFeatureEnabled("adminPremiumAccess")) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Premium access controls are disabled in this environment.
        </div>
      </div>
    );
  }
  const initialOverview = await getPremiumAccessOverview();
  return <AdminPremiumAccessPanel initialOverview={initialOverview} />;
}
