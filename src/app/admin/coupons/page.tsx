export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { listCoupons } from "@/server/pricing/coupons-service";
import { AdminCouponsPanel } from "@/components/admin/AdminCouponsPanel";

export default async function AdminCouponsPage() {
  if (!isFeatureEnabled("adminCoupons")) notFound();
  const coupons = await listCoupons();
  return <AdminCouponsPanel initial={coupons} />;
}
