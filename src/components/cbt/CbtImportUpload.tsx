"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mutateJson } from "@/lib/csrf";
import type { DocumentImportJob } from "@/server/workspaces/types";

export function CbtImportUpload({ initialJobs }: { initialJobs: DocumentImportJob[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        {initialJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="space-y-2">
            {initialJobs.map((job) => (
              <li key={job.id} className="neu-raised p-3">
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
