"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cbtLogoutAction } from "@/server/actions/cbt-auth-actions";

const NAV_ITEMS = [
  { label: "Rooms", href: "/cbt/rooms" },
  { label: "Tests", href: "/cbt/tests" },
  { label: "Questions", href: "/cbt/questions" },
  { label: "Import", href: "/cbt/import" },
];

/**
 * Teacher shell chrome for the /cbt app (top nav + sign out). Wraps every
 * teacher page via the (teacher) layout.
 */
export function CbtShell({
  children,
  teacherName,
}: {
  children: React.ReactNode;
  teacherName?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await cbtLogoutAction();
      router.push("/cbt/login");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/cbt" className="text-sm font-black uppercase tracking-widest text-foreground">
              CBT
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
                        : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {teacherName ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{teacherName}</span>
            ) : null}
            <Button size="sm" variant="outline" disabled={isPending} onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
