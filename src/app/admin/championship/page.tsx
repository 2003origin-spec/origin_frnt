import { getChampionshipPrize } from '@/server/platform-settings';
import AdminChampionshipControls from '@/components/admin/AdminChampionshipControls';

// Admin access is enforced by src/app/admin/layout.tsx (role gate).
export const dynamic = 'force-dynamic';

export default async function AdminChampionshipPage() {
  const prize = await getChampionshipPrize().catch(() => ({ imageUrl: null, label: null }));
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-black tracking-tight">Championship</h1>
      <AdminChampionshipControls initialImageUrl={prize.imageUrl} initialLabel={prize.label} />
    </div>
  );
}
