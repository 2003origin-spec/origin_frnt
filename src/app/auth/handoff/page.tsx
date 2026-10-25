export const dynamic = "force-dynamic";

/**
 * App → browser link-out confirmation (bug-fix spec 01-auth.md §A4).
 *
 * GET /api/mobile/link-out/consume no longer logs the browser in: it 303s
 * here. This page only PEEKS the one-time token (no consumption) and shows
 * which account the browser is about to be signed in as; the explicit
 * Continue button is a same-origin form POST that consumes the token. That
 * visible, deliberate step is what stops a login-CSRF link (an attacker's
 * token opened in the victim's browser) from silently swapping accounts.
 *
 * Public page (route-policy PUBLIC_APP_PATHS): the browser usually has no
 * Origin session yet.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerUser } from "@/lib/auth-server";
import { dbFindUserById } from "@/server/db-users";
import { HANDOFF_PURPOSES, peekHandoffToken } from "@/server/mobile/handoff";
import { readStoreAsync } from "@/server/store";
import { isUserPostgresConfigured } from "@/server/user-postgres";

export const metadata: Metadata = {
  title: "Continue in browser — Origin",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = {
  searchParams: Promise<{ token?: string | string[] }>;
};

type Identity = { id: string; email: string; name: string };

const PURPOSE_LABELS: Record<keyof typeof HANDOFF_PURPOSES, string> = {
  premium: "Origin Premium",
};

function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

async function findUser(userId: string): Promise<Identity | null> {
  if (isUserPostgresConfigured()) {
    const user = await dbFindUserById(userId);
    return user ? { id: user.id, email: user.email, name: user.name } : null;
  }
  const store = await readStoreAsync();
  const user = store.users.find((entry) => entry.id === userId);
  return user ? { id: user.id, email: user.email, name: user.name } : null;
}

async function currentBrowserUser(): Promise<Identity | null> {
  try {
    const user = await getServerUser();
    return user ? { id: user.id, email: user.email, name: user.name } : null;
  } catch {
    return null;
  }
}

function ExpiredCard() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>This link has expired</CardTitle>
        <CardDescription>
          Sign-in links from the app work once and only for a minute. Go back to the Origin app and tap the
          button again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/auth">Sign in here instead</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function HandoffPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  const record = token ? await peekHandoffToken(token).catch(() => null) : null;
  const target = record ? await findUser(record.userId).catch(() => null) : null;

  if (!record || !target) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <ExpiredCard />
      </main>
    );
  }

  const current = await currentBrowserUser();
  const switching = current !== null && current.id !== target.id;
  const destination = PURPOSE_LABELS[record.purpose];
  const targetEmail = maskEmail(target.email);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{switching ? "Switch account?" : `Continue to ${destination}`}</CardTitle>
          <CardDescription>
            {switching ? (
              <>
                You are signed in as <strong>{maskEmail(current.email)}</strong> in this browser. Continue as{" "}
                <strong>{targetEmail}</strong>? This will sign {maskEmail(current.email)} out in this browser.
              </>
            ) : (
              <>
                You will be signed in as <strong>{targetEmail}</strong>. Only continue if you opened this from
                your own Origin app.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form method="POST" action="/api/mobile/link-out/consume">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" className="w-full">
              Continue as {targetEmail}
            </Button>
          </form>
          {switching ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={HANDOFF_PURPOSES[record.purpose]}>Stay as {maskEmail(current.email)}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
