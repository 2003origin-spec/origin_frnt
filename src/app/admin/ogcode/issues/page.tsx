export const dynamic = "force-dynamic";

import { AdminOgcodeIssues } from "@/components/admin/AdminOgcodeIssues";
import { listOgcodeQuestionReports, getOgcodeReportStatusCounts } from "@/server/ogcode-reports";

export default async function AdminOgcodeIssuesPage() {
  const [reports, counts] = await Promise.all([
    listOgcodeQuestionReports({ limit: 200 }),
    getOgcodeReportStatusCounts(),
  ]);
  return <AdminOgcodeIssues initialReports={reports} initialCounts={counts} />;
}
