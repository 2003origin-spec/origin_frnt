export const dynamic = "force-dynamic";

import { AdminUsersBrowser } from "@/components/admin/AdminUsersBrowser";

type Props = { searchParams: Promise<{ role?: string; plan?: string }> };

const PLAN_VALUES = ["free", "premium", "paid", "comp", "teacher"] as const;

export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialRole =
    sp.role === "student" || sp.role === "teacher" || sp.role === "admin" ? sp.role : "all";
  const initialPlan = (PLAN_VALUES as readonly string[]).includes(sp.plan ?? "")
    ? (sp.plan as (typeof PLAN_VALUES)[number])
    : "all";
  return <AdminUsersBrowser initialRole={initialRole} initialPlan={initialPlan} />;
}
