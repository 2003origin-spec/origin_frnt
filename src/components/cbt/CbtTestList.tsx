"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutateJson } from "@/lib/csrf";
import type { CbtTest } from "@/lib/cbt/test-model";

export function CbtTestList({ initialTests }: { initialTests: CbtTest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await mutateJson("/api/cbt/tests", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), durationMinutes: Number(duration) || 60 }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; test?: { id: string } };
      if (!res.ok || !data.test) {
        setError(data.detail ?? `Create failed (${res.status})`);
        return;
      }
      router.push(`/cbt/tests/${data.test.id}`);
    });
  }

  function remove(test: CbtTest) {
    setError(null);
    if (!window.confirm(`Delete "${test.title}"? This permanently removes the test and its questions list. This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await mutateJson(`/api/cbt/tests/${test.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(data.detail ?? `Delete failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">Tests</h1>
        <p className="text-sm text-muted-foreground">{initialTests.length} test(s)</p>
      </header>

      <div className="neu-raised flex flex-col gap-2 p-4 sm:flex-row">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New test title" className="flex-1" />
        <Input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="sm:w-32"
          placeholder="Minutes"
          inputMode="numeric"
        />
        <Button className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" disabled={pending || !title.trim()} onClick={create}>
          Create
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {initialTests.length === 0 ? (
        <div className="neu-inset rounded-2xl border border-dashed border-border/50 p-10 text-center text-muted-foreground">
          No tests yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {initialTests.map((t) => (
            <li key={t.id} className="neu-raised flex items-center justify-between gap-3 p-4">
              <Link href={`/cbt/tests/${t.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.questionCount} questions · {t.maxScore} marks · {t.durationMinutes} min
                  </div>
                </div>
                <span
                  className={
                    t.status === "ready"
                      ? "shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400"
                      : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {t.status}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => remove(t)}
                disabled={pending}
                aria-label={`Delete test ${t.title}`}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
