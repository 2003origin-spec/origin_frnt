"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mutateJson } from "@/lib/csrf";
import type { OgcodeAdminReport, OgcodeReportStatus } from "@/server/ogcode-reports";

// Local copy of the status list (server const lives in a pg-importing module).
const OGCODE_REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;

type Counts = Record<OgcodeReportStatus, number>;

const REASON_LABEL: Record<string, string> = {
  incorrect_answer: "Incorrect answer",
  unclear_question: "Unclear / ambiguous",
  typo_or_formatting: "Typo / formatting",
  wrong_options: "Wrong / missing options",
  image_missing: "Image missing",
  other: "Other",
};

const STATUS_STYLE: Record<OgcodeReportStatus, string> = {
  open: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  reviewing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  dismissed: "bg-muted text-muted-foreground",
};

type EditQuestion = {
  id: string;
  text: string;
  options: string[] | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  explanation: string;
  hint: string | null;
  subject: string;
  chapter: string;
  difficulty: string;
  questionType: string;
};

export function AdminOgcodeIssues({
  initialReports,
  initialCounts,
}: {
  initialReports: OgcodeAdminReport[];
  initialCounts: Counts;
}) {
  const [reports, setReports] = useState(initialReports);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<OgcodeReportStatus | "all">("all");
  const [editing, setEditing] = useState<EditQuestion | null>(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  async function refresh() {
    const res = await fetch("/api/admin/ogcode/reports", { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { reports: OgcodeAdminReport[]; counts: Counts };
      setReports(data.reports);
      setCounts(data.counts);
    }
  }

  async function setStatus(report: OgcodeAdminReport, status: OgcodeReportStatus) {
    setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status } : r)));
    setCounts((prev) => ({ ...prev, [report.status]: Math.max(0, prev[report.status] - 1), [status]: prev[status] + 1 }));
    await mutateJson(`/api/admin/ogcode/reports/${report.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
  }

  async function openEditor(questionId: string) {
    setError(null);
    setLoadingQ(true);
    try {
      const res = await fetch(`/api/admin/ogcode/questions/${questionId}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { question?: EditQuestion; detail?: string };
      if (!res.ok || !data.question) throw new Error(data.detail ?? "Could not load the question.");
      setEditing(data.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the question.");
    } finally {
      setLoadingQ(false);
    }
  }

  async function saveEditor() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await mutateJson(`/api/admin/ogcode/questions/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(editing),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail ?? "Save failed.");
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const usesOptions = editing?.questionType === "mcq" || editing?.questionType === "msq";

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OG-Code Issues</h1>
        <p className="text-sm text-muted-foreground">Student-reported problems. Fix the question, then resolve.</p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {(["all", ...OGCODE_REPORT_STATUSES] as const).map((s) => {
          const active = filter === s;
          const n = s === "all" ? reports.length : counts[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s} ({n})
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{visible.length} report{visible.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reason</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs font-bold">{REASON_LABEL[r.reason] ?? r.reason}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{r.questionStem ?? "(question missing)"}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.description ?? "—"}</TableCell>
                      <TableCell className="text-xs uppercase">{r.questionSubject ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLE[r.status]}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="outline" disabled={loadingQ} onClick={() => openEditor(r.questionId)}>
                            Edit question
                          </Button>
                          <select
                            value={r.status}
                            onChange={(e) => setStatus(r, e.target.value as OgcodeReportStatus)}
                            className="rounded-md border border-border bg-transparent px-2 py-1 text-xs"
                          >
                            {OGCODE_REPORT_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Question text (supports $LaTeX$)</Label>
                <Textarea rows={3} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
              </div>

              {usesOptions && editing.options ? (
                <div className="space-y-2">
                  <Label>Options {editing.questionType === "mcq" ? "(pick one correct)" : "(pick all correct)"}</Label>
                  {editing.options.map((opt, i) => {
                    const isCorrect =
                      editing.questionType === "mcq"
                        ? editing.correctOption === i
                        : (editing.correctOptions ?? []).includes(i);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type={editing.questionType === "mcq" ? "radio" : "checkbox"}
                          checked={isCorrect}
                          onChange={() => {
                            if (editing.questionType === "mcq") {
                              setEditing({ ...editing, correctOption: i });
                            } else {
                              const cur = new Set(editing.correctOptions ?? []);
                              if (cur.has(i)) cur.delete(i); else cur.add(i);
                              setEditing({ ...editing, correctOptions: [...cur].sort((a, b) => a - b) });
                            }
                          }}
                        />
                        <span className="w-5 text-xs font-bold text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const next = [...(editing.options ?? [])];
                            next[i] = e.target.value;
                            setEditing({ ...editing, options: next });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {!usesOptions ? (
                <div className="space-y-1">
                  <Label>Correct answer</Label>
                  <Input value={editing.answerText ?? ""} onChange={(e) => setEditing({ ...editing, answerText: e.target.value })} />
                </div>
              ) : null}

              <div className="space-y-1">
                <Label>Explanation</Label>
                <Textarea rows={3} value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Hint</Label>
                <Input value={editing.hint ?? ""} onChange={(e) => setEditing({ ...editing, hint: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Subject</Label>
                  <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Chapter</Label>
                  <Input value={editing.chapter} onChange={(e) => setEditing({ ...editing, chapter: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Difficulty</Label>
                  <select
                    value={editing.difficulty}
                    onChange={(e) => setEditing({ ...editing, difficulty: e.target.value })}
                    className="w-full rounded-md border border-border bg-transparent px-2 py-2 text-sm"
                  >
                    {["easy", "medium", "hard", "insane"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error ? <p className="text-xs font-bold text-rose-500">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEditor} disabled={saving}>{saving ? "Saving…" : "Save question"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        <button onClick={refresh} className="underline hover:text-foreground">Refresh</button> to re-pull the latest reports.
      </p>
    </div>
  );
}
