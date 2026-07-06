"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { csrfHeaders } from "@/lib/csrf";
import type { DocumentImportJob } from "@/server/workspaces/types";

export function CbtImportUpload({ initialJobs }: { initialJobs: DocumentImportJob[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.append("file", file);
    startTransition(async () => {
      // No content-type header — the browser sets the multipart boundary.
      const res = await fetch("/api/cbt/import-jobs", {
        method: "POST",
        headers: { ...csrfHeaders() },
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; job?: { id: string } };
      if (!res.ok || !data.job) {
        setError(data.detail ?? `Upload failed (${res.status})`);
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      router.push(`/cbt/import/${data.job.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">Import questions</h1>
        <p className="text-sm text-muted-foreground">Upload a PDF or DOCX. AI extracts questions for your review.</p>
      </header>

      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Uploading…" : "Choose file"}
        </Button>
        {error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Recent imports</h2>
        {initialJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="space-y-2">
            {initialJobs.map((job) => (
              <li key={job.id} className="rounded-lg border border-border bg-card p-3">
                <Link href={`/cbt/import/${job.id}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-foreground">{job.sourceFileName}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {job.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
