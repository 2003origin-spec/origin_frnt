export const dynamic = "force-dynamic";

import Link from "next/link";

import { MessageReportsConsole } from "@/components/admin/messaging/MessageReportsConsole";

/**
 * /admin/moderation/messages — reports students made about student messages
 * (contract addendum 02/11/2026). The admin layout already requires the admin
 * role; every data call goes through /api/admin/messaging/*, which checks it
 * again. Not behind the studentMessaging flag, so reports can be worked while
 * messaging is switched off.
 */
export default function AdminMessageReportsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="text-sm">
          <Link className="text-muted-foreground underline" href="/admin/moderation">
            Moderation
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Message reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports students made about messages. Read the conversation, then dismiss, warn or pause the student&apos;s messaging.
        </p>
      </div>
      <MessageReportsConsole />
    </div>
  );
}
