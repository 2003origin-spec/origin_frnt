"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mutateJson } from "@/lib/csrf";
import type { DocumentImportJob } from "@/server/workspaces/types";

/** The statuses that hold a slot against the 5-job import concurrency cap, and
 * so the only ones the server will delete. Mirrors ACTIVE_IMPORT_JOB_STATUSES
 * in document-import-service — a row outside this set shows no Delete button. */
const DELETABLE_STATUSES = new Set(["queued", "processing"]);

export function CbtImportUpload({ initialJobs }: { initialJobs: DocumentImportJob[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Deleted rows are tracked as an id set rather than a local copy of the list:
  // the parent is a server component, so router.refresh() pushes a fresh
  // `initialJobs` prop, and a useState copy would ignore it and go stale.
  // Filtering props keeps the row hidden instantly AND stays live.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const jobs = initialJobs.filter((job) => !deletedIds.has(job.id));
  // Two-step confirm, per row. window.confirm() blocks the whole tab and can't
  // be driven in a test, so the row arms itself instead.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function deleteJob(jobId: string) {
    setRowError(null);
    setDeletingId(jobId);
    try {
      const res = await mutateJson(`/api/cbt/import-jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setRowError({ id: jobId, message: data.detail ?? `Delete failed (${res.status})` });
        return;
      }
      setDeletedIds((prev) => new Set(prev).add(jobId));
      setConfirmingId(null);
      // Frees a slot against the concurrency cap — refresh so any other view of
      // the queue (and the server-rendered list) reflects it.
      router.refresh();
    } catch (e) {
      setRowError({ id: jobId, message: e instanceof Error ? e.message : "Delete failed. Please retry." });
    } finally {
      setDeletingId(null);
    }
  }

  // Above this, upload straight to R2 (presigned) to dodge Vercel's ~4.5 MB
  // serverless body limit — this is what let large PDFs fail before.
  const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
      try {
        const mimeType = file.type || "application/octet-stream";
        let res: Response;

        if (file.size > DIRECT_UPLOAD_THRESHOLD) {
          // 1) ask the server for a presigned R2 PUT URL
          const presignRes = await mutateJson("/api/cbt/import-jobs/presign", {
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
          // 2) PUT the bytes DIRECTLY to R2 (no server hop → no body-size cap)
          const put = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": mimeType },
            body: file,
          });
          if (!put.ok) {
            setError(`Direct upload to storage failed (${put.status}). Please retry.`);
            return;
          }
          // 3) register the import job against the uploaded object (small JSON)
          res = await mutateJson("/api/cbt/import-jobs", {
            method: "POST",
            body: JSON.stringify({
              objectKey: presign.objectKey,
              bucket: presign.bucket,
              fileName: file.name,
              mimeType,
              size: file.size,
            }),
          });
        } else {
          // Small file: the simple multipart path (well under the limit).
          const form = new FormData();
          form.append("file", file);
          res = await mutateJson("/api/cbt/import-jobs", { method: "POST", body: form });
        }

        const data = (await res.json().catch(() => ({}))) as { detail?: string; job?: { id: string } };
        if (!res.ok || !data.job) {
          setError(data.detail ?? `Upload failed (${res.status})`);
          return;
        }
        if (inputRef.current) inputRef.current.value = "";
        router.push(`/cbt/import/${data.job.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed. Please retry.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">Import questions</h1>
        <p className="text-sm text-muted-foreground">Upload a PDF or DOCX. AI extracts questions for your review.</p>
      </header>

      <div className="neu-inset rounded-2xl border border-dashed border-border/50 p-6 text-center">
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
        <Button className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" disabled={pending} onClick={() => inputRef.current?.click()}>
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
                <li key={job.id} className="neu-raised p-3">
                  {/* The link is a sibling of the button, never its parent: a
                      button nested in an anchor is invalid HTML and the click
                      would navigate instead of deleting. */}
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/cbt/import/${job.id}`} className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {job.sourceFileName}
                    </Link>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {job.status}
                    </span>
                    {deletable ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => (confirming ? deleteJob(job.id) : setConfirmingId(job.id))}
                          aria-label={confirming ? `Confirm delete ${job.sourceFileName}` : `Delete ${job.sourceFileName}`}
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
                  {confirming && !deleting ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Permanently deletes this import and everything extracted from it. This frees a slot in the import queue.
                    </p>
                  ) : null}
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
