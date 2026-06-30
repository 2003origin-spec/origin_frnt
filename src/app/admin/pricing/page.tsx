export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getAdminPricing } from "@/server/pricing/pricing-service";
import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";

export default async function AdminPricingPage() {
  if (!isFeatureEnabled("adminPricing")) notFound();
  const pricing = await getAdminPricing();
  return <AdminPricingPanel initial={pricing} />;
}
