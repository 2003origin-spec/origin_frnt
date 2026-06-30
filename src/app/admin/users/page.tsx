export const dynamic = "force-dynamic";

import { AdminUsersBrowser } from "@/components/admin/AdminUsersBrowser";

type Props = { searchParams: Promise<{ role?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialRole =
    sp.role === "student" || sp.role === "teacher" || sp.role === "admin" ? sp.role : "all";
  return <AdminUsersBrowser initialRole={initialRole} />;
}
