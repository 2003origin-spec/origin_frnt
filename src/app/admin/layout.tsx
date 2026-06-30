import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import AdminLayout from '@/components/layout/AdminLayout';

/**
 * Server-side auth guard + shared admin shell for every /admin/* route. The
 * cookie read happens here (server) and the sidebar/top-bar chrome is rendered
 * once via AdminLayout, so individual admin pages render only their own content
 * (no per-page <AdminLayout> wrapper — that would double up the sidebar).
 */
export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  if (!user || user.role !== 'admin') {
    redirect('/auth?role=admin');
  }

  return <AdminLayout>{children}</AdminLayout>;
}
