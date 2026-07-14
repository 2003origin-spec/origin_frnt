"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cbtLogoutAction } from "@/server/actions/cbt-auth-actions";

const NAV_ITEMS = [
  { label: "Rooms", href: "/cbt/rooms" },
  { label: "Tests", href: "/cbt/tests" },
  { label: "Questions", href: "/cbt/questions" },
  { label: "Import", href: "/cbt/import" },
  { label: "Settings", href: "/cbt/settings" },
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
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration mismatch: resolvedTheme is undefined on the server/first
  // client render, so default to light until mounted (matches ClientShellInner).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const currentTheme = (mounted ? resolvedTheme : "light") || "light";

  function logout() {
    startTransition(async () => {
      await cbtLogoutAction();
      router.push("/cbt/login");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen neu-surface">
      <header className="neu-surface relative z-10 border-b border-border/30 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/cbt" className="text-sm font-black uppercase tracking-widest text-primary">
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
                        ? "neu-inset rounded-xl px-3 py-1.5 text-sm font-bold text-primary"
                        : "rounded-xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
            <button
              type="button"
              onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
              title={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="neu-raised flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-amber-500"
            >
              {currentTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none hover:-translate-y-0.5" disabled={isPending} onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
