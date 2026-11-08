import { getAppIcon } from '@/server/platform-settings';
import AdminAppIconControls from '@/components/admin/AdminAppIconControls';

// Admin access is enforced by src/app/admin/layout.tsx (role gate).
export const dynamic = 'force-dynamic';

export default async function AdminAppIconPage() {
  const icon = await getAppIcon().catch(() => null);
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-black tracking-tight">App icon</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        The icon on students&apos; home screens. Phones switch the next time the student leaves the app (app version 20018 or later).
        Change the Play Store icon in Play Console too: the two are separate.
      </p>
      <AdminAppIconControls initialIcon={icon} />
    </div>
  );
}
