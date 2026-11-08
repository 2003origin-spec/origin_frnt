export const dynamic = "force-dynamic";

import { AnnouncementsConsole } from "@/components/admin/announcements/AnnouncementsConsole";

/**
 * /admin/announcements — send an announcement to students: an in-app
 * notification (the bell) for everyone in the audience, and a phone
 * notification for those with the app. The admin layout already requires the
 * admin role; every data call goes through /api/admin/announcements/*, which
 * checks it again.
 */
export default function AdminAnnouncementsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a short message to students. It shows in their notifications on the website and the app, and as a phone
          notification for students who have the app.
        </p>
      </div>
      <AnnouncementsConsole />
    </div>
  );
}
