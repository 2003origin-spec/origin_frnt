import type { Metadata } from "next";

import { DeleteAccountCard } from "@/components/account/DeleteAccountCard";

/**
 * Public account-deletion page (ANDROID_HYBRID_APP_PLAN.md §5.6).
 *
 * Google Play requires a web URL — reachable without installing the app —
 * where users can delete their account; this page doubles as the in-app
 * entry (linked from Profile → Settings). The page itself is public
 * (route-policy PUBLIC_APP_PATHS); the destructive call is authenticated
 * and email-confirmed server-side.
 */

export const metadata: Metadata = {
  title: "Delete your account — ORIGIN",
  description: "Permanently delete your ORIGIN account and personal data.",
  robots: { index: false },
};

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Delete your account</h1>
        <p className="text-sm text-muted-foreground">
          Deleting your ORIGIN account removes your personal information — name, email, mobile
          number, photo and public profile — immediately and permanently, and cancels any active
          premium subscriptions. Test attempts and aggregate statistics are kept in anonymised form
          only. This cannot be undone.
        </p>
      </div>
      <DeleteAccountCard />
      <p className="text-xs text-muted-foreground">
        Locked out of your account? Email support from your registered address and we will verify
        and process the deletion manually.
      </p>
    </main>
  );
}
