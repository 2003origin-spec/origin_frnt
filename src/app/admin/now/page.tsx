export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { NowAdminConsole } from "@/components/admin/now/NowAdminConsole";

/**
 * /admin/now — Origin NOW admin console. The admin layout already requires the
 * admin role; every data call goes through /api/admin/now/*, which checks it
 * again. Deliberately NOT behind the originNow flag, so prices, packs, the
 * cohort and the store can be set up before the feature is switched on.
 */
export default function AdminNowPage() {
  return (
    <Suspense fallback={null}>
      <NowAdminConsole />
    </Suspense>
  );
}
