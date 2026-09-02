"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mutateJson } from "@/lib/csrf";
import type { DocumentImportJob } from "@/server/workspaces/types";

/** Statuses that hold a slot against the import concurrency cap (deletable). */
const DELETABLE_STATUSES = new Set(["queued", "processing"]);
// Above this, upload straight to R2 (presigned) to dodge the ~4.5 MB body limit.
const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;

export function ContestImportUpload({ initialJobs }: { initialJobs: DocumentImportJob[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const jobs = initialJobs.filter((job) => !deletedIds.has(job.id));
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function deleteJob(jobId: string) {
    setRowError(null);
    setDeletingId(jobId);
    try {
      const res = await mutateJson(`/api/admin/contest/import-jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setRowError({ id: jobId, message: data.detail ?? `Delete failed (${res.status})` });
        return;
      }
      setDeletedIds((prev) => new Set(prev).add(jobId));
      setConfirmingId(null);
      router.refresh();
    } catch (e) {
      setRowError({ id: jobId, message: e instanceof Error ? e.message : "Delete failed. Please retry." });
    } finally {
      setDeletingId(null);
    }
  }

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
      try {
        const mimeType = file.type || "application/octet-stream";
        let res: Response;
        if (file.size > DIRECT_UPLOAD_THRESHOLD) {
          const presignRes = await mutateJson("/api/admin/contest/import-jobs/presign", {
            method: "POST",
            body: JSON.stringify({ fileName: file.name, mimeType }),
          });
          const presign = (await presignRes.json().catch(() => ({}))) as {
            detail?: string; uploadUrl?: string; objectKey?: string; bucket?: string;
          };
          if (!presignRes.ok || !presign.uploadUrl || !presign.objectKey || !presign.bucket) {
            setError(presign.detail ?? `Upload failed (${presignRes.status})`);
            return;
          }
          const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
          if (!put.ok) {
            setError(`Direct upload to storage failed (${put.status}). Please retry.`);
            return;
          }
          res = await mutateJson("/api/admin/contest/import-jobs", {
            method: "POST",
            body: JSON.stringify({ objectKey: presign.objectKey, bucket: presign.bucket, fileName: file.name, mimeType, size: file.size }),
          });
        } else {
          const form = new FormData();
          form.append("file", file);
          res = await mutateJson("/api/admin/contest/import-jobs", { method: "POST", body: form });
        }
        const data = (await res.json().catch(() => ({}))) as { detail?: string; job?: { id: string } };
        if (!res.ok || !data.job) {
          setError(data.detail ?? `Upload failed (${res.status})`);
          return;
        }
        if (inputRef.current) inputRef.current.value = "";
        router.push(`/admin/contest/import/${data.job.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed. Please retry.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Import contest questions</h1>
          <p className="text-sm text-muted-foreground">
            Upload a PDF or DOCX. AI extracts MCQs for your review; accepted questions join the contest question pool.
          </p>
        </div>
        <Link href="/admin/contest" className="shrink-0 text-sm text-muted-foreground hover:text-primary">
          ← Back to contests
        </Link>
      </header>

      <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
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
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => {
              const deletable = DELETABLE_STATUSES.has(job.status);
              const confirming = confirmingId === job.id;
              const deleting = deletingId === job.id;
              return (
                <li key={job.id} className="rounded-xl border border-border/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/admin/contest/import/${job.id}`} className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {job.sourceFileName}
                    </Link>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{job.status}</span>
                    {deletable ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => (confirming ? deleteJob(job.id) : setConfirmingId(job.id))}
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {deleting ? "Deleting…" : confirming ? "Confirm delete?" : "Delete"}
                        </button>
                        {confirming && !deleting ? (
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {rowError?.id === job.id ? (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      {rowError.message}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
