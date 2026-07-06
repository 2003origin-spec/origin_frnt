"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { csrfHeaders } from "@/lib/csrf";
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
      const res = await fetch("/api/cbt/tests", {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">Tests</h1>
        <p className="text-sm text-muted-foreground">{initialTests.length} test(s)</p>
      </header>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New test title" className="flex-1" />
        <Input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="sm:w-32"
          placeholder="Minutes"
          inputMode="numeric"
        />
        <Button disabled={pending || !title.trim()} onClick={create}>
          Create
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {initialTests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No tests yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {initialTests.map((t) => (
            <li key={t.id} className="rounded-lg border border-border bg-card p-4">
              <Link href={`/cbt/tests/${t.id}`} className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-foreground">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.questionCount} questions · {t.maxScore} marks · {t.durationMinutes} min
                  </div>
                </div>
                <span
                  className={
                    t.status === "ready"
                      ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {t.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
