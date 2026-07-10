"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { csrfHeaders } from "@/lib/csrf";
import type { CbtTeacher, CbtUsageStats } from "@/server/cbt/cbt-teachers-service";

type Props = {
  initialTeachers: CbtTeacher[];
  initialStats: CbtUsageStats;
};

const STAT_CARDS: { key: keyof CbtUsageStats; label: string }[] = [
  { key: "activeTeachers", label: "Active teachers" },
  { key: "totalTeachers", label: "Total teachers" },
  { key: "totalQuestions", label: "Questions" },
  { key: "totalTests", label: "Tests" },
  { key: "totalRooms", label: "Rooms" },
  { key: "totalParticipants", label: "Participants" },
];

export function AdminCbtTeachers({ initialTeachers, initialStats }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addTeacher() {
    setError(null);
    const res = await fetch("/api/admin/cbt/teachers", {
      method: "POST",
      headers: { "content-type": "application/json", ...csrfHeaders() },
      credentials: "include",
      body: JSON.stringify({ email: email.trim(), displayName: displayName.trim() || null }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? `Add failed (${res.status})`);
      return;
    }
    setEmail("");
    setDisplayName("");
    router.refresh();
  }

  async function removeTeacher(teacher: CbtTeacher) {
    setError(null);
    if (!window.confirm(`Disable CBT access for ${teacher.email}? Their live sessions will be revoked.`)) {
      return;
    }
    const res = await fetch("/api/admin/cbt/teachers", {
      method: "DELETE",
      headers: { "content-type": "application/json", ...csrfHeaders() },
      credentials: "include",
      body: JSON.stringify({ id: teacher.id }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? `Remove failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">CBT</h1>
        <p className="text-sm text-muted-foreground">
          Manage the CBT teacher allowlist. Only active teachers can sign in at <code>/cbt</code>.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="neu-raised p-4">
            <div className="text-2xl font-black text-foreground">{initialStats[card.key]}</div>
            <div className="text-xs text-muted-foreground">{card.label}</div>
          </div>
        ))}
      </section>

      <section className="neu-raised p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Add a teacher</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@example.com"
            className="neu-inset flex-1 rounded-xl bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (optional)"
            className="neu-inset flex-1 rounded-xl bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
          <Button
            className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
            disabled={isPending || !email.trim()}
            onClick={() => startTransition(() => addTeacher())}
          >
            Add
          </Button>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="neu-raised overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Display name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialTeachers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No CBT teachers yet.
                </td>
              </tr>
            ) : (
              initialTeachers.map((teacher) => (
                <tr key={teacher.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-foreground">{teacher.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{teacher.displayName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        teacher.status === "active"
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {teacher.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(teacher.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {teacher.status === "active" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="shadow-lg shadow-red-600/20 transition-transform hover:-translate-y-0.5"
                        disabled={isPending}
                        onClick={() => startTransition(() => removeTeacher(teacher))}
                      >
                        Disable
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">disabled</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
