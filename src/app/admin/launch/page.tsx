export const dynamic = "force-dynamic";

import { getLaunchSettings } from "@/server/launch-settings";
import { AdminLaunchControls } from "@/components/admin/AdminLaunchControls";

export default async function AdminLaunchPage() {
  const settings = await getLaunchSettings();
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Launch Controls</h1>
        <p className="text-sm text-muted-foreground">
          Gate access and run the pre-launch cover page with a live countdown.
        </p>
      </div>
      <AdminLaunchControls initial={settings} />
    </div>
  );
}
