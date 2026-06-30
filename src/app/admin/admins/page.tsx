export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { isMainAdmin, listAdmins } from "@/server/admin/admins-service";
import { AdminAdminsPanel } from "@/components/admin/AdminAdminsPanel";

export default async function AdminAdminsPage() {
  if (!isFeatureEnabled("adminSubAdmins")) notFound();
  const user = await getServerUser();
  const main = user ? await isMainAdmin(user.id) : false;

  if (!main) {
    return (
      <div className="max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Admins — restricted</h1>
          <p className="text-sm text-muted-foreground mt-1">Only the main admin can create or remove sub-admins. You have full access to every other admin tool.</p>
        </div>
      </div>
    );
  }

  const admins = await listAdmins();
  return <AdminAdminsPanel initial={admins} />;
}
