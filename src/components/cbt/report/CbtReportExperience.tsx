"use client";

/**
 * The public report-card surface: a CBT-ID gate, then the report.
 *
 * On mount it tries the cookie first, so a student who already unlocked (or who
 * printed and came back) doesn't have to type their ID again. Everything about
 * the gate is deliberately unhelpful to a stranger — a wrong ID, an unpublished
 * room and a disabled feature all say as little as possible, and the server
 * counts wrong IDs against a per-IP failure limit.
 */

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CbtReportCard as CbtReportCardData } from "@/server/cbt/cbt-report-service";

import { CbtReportCard } from "./CbtReportCard";

type Phase = "checking" | "gate" | "ready";

export function CbtReportExperience({
  slug,
  roomName,
  instituteName,
  instituteLogo,
}: {
  slug: string;
  roomName: string;
  instituteName: string | null;
  instituteLogo: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [report, setReport] = useState<CbtReportCardData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already unlocked on this device? Then skip the gate entirely.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cbt-student/report", { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { report?: CbtReportCardData };
          if (data.report) {
            setReport(data.report);
            setPhase("ready");
            return;
          }
        }
      } catch {
        // Offline or blocked — fall through to the gate, which retries.
      }
      if (!cancelled) setPhase("gate");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter the CBT ID you were given during the test.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cbt-student/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug, studentCode: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as { report?: CbtReportCardData; detail?: string };
      if (!res.ok || !data.report) {
        setError(
          data.detail ??
            (res.status === 429
              ? "Too many tries. Please wait a little and try again."
              : "Could not open your report."),
        );
        return;
      }
      setReport(data.report);
      setPhase("ready");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [code, slug]);

  if (phase === "checking") {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Centered>
    );
  }

  if (phase === "ready" && report) {
    return <CbtReportCard report={report} />;
  }

  return (
    <Centered>
      <div className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="flex items-center justify-center gap-3">
          {instituteLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={instituteLogo}
              alt={instituteName ?? "Institute"}
              className="h-11 w-11 rounded-xl object-contain"
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Origin-New-Logo.jpeg" alt="Origin" className="h-11 w-11 rounded-xl object-contain" />
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-black tracking-tight text-foreground">Your result</h1>
          <p className="text-sm text-muted-foreground">{roomName}</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
        >
          <div className="space-y-1.5 text-left">
            <label htmlFor="cbt-code" className="text-xs font-medium text-muted-foreground">
              Enter your CBT ID
            </label>
            <Input
              id="cbt-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CBT-XXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="text-center font-mono text-lg tracking-[0.2em]"
            />
            <p className="text-[11px] text-muted-foreground">
              This is the ID shown on your screen when you joined and submitted the test.
            </p>
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Opening…" : "View my report"}
          </Button>
        </form>

        <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Origin-New-Logo.jpeg" alt="" className="h-3.5 w-3.5 rounded object-contain" />
          powered by <span className="font-semibold text-foreground">o3origin.com</span>
        </p>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-5">{children}</main>
  );
}
