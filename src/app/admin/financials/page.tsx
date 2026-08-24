export const dynamic = "force-dynamic";

import { AdminFinancialsPanel } from "@/components/admin/AdminFinancialsPanel";

/**
 * /admin/financials — real numbers from the money ledger.
 *
 * The panel is a client component because the screen is interactive (range,
 * mode, ledger filters, CSV export) and every read is an admin-authenticated
 * API call. `src/app/admin/layout.tsx` already renders <AdminLayout> and guards
 * the role server-side, so this page must NOT wrap the layout again — the
 * previous mock version did, which rendered the sidebar twice.
 */
export default function AdminFinancialsPage() {
  return <AdminFinancialsPanel />;
}
