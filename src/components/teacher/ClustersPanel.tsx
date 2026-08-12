"use client";

/**
 * Question clusters — the Question Bag's "Clusters" tab.
 *
 * A cluster is a named, ORDERED group of Question-Bag questions that can be
 * stacked into a paper. Questions are referenced, never copied: the same
 * question may sit in several clusters, and removing it from one changes
 * nothing anywhere else.
 *
 * Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md D1, D4, D5, D8.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/teacher-client";
import { cn } from "@/lib/utils";
import type { QuestionWithVersion } from "@/server/workspaces/types";

export type ClusterMemberView = { questionId: string; position: number; addedAt: string };
export type ClusterView = {
  id: string;
  name: string;
  description: string | null;
  sourceImportJobId: string | null;
  questionCount: number;
  createdAt: string;
  members?: ClusterMemberView[];
};

type Props = {
  workspaceId: string;
  initialClusters: ClusterView[];
  /** The workspace's bag questions — the pool clusters draw from. */
  questions: QuestionWithVersion[];
  canEdit: boolean;
  /**
   * Hands control back to the Library tab in create mode, remembering that the
   * new question should be appended to this cluster — "put questions into a
   * cluster by creating one manually".
   */
  onCreateQuestionForCluster: (clusterId: string) => void;
};

function stemOf(question: QuestionWithVersion): string {
  return question.currentVersion?.stem?.trim() || "Untitled question";
}

export function ClustersPanel({
  workspaceId,
  initialClusters,
  questions,
  canEdit,
  onCreateQuestionForCluster,
}: Props) {
  const router = useRouter();
  const [clusters, setClusters] = useState<ClusterView[]>(initialClusters);
  const [selectedId, setSelectedId] = useState<string | null>(initialClusters[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const selected = clusters.find((c) => c.id === selectedId) ?? null;
  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const memberIds = useMemo(
    () => selected?.members?.map((m) => m.questionId) ?? [],
    [selected],
  );
  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  /** Questions not already in the open cluster, filtered by the picker query. */
  const pickable = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    return questions
      .filter((q) => !memberSet.has(q.id))
      .filter((q) => {
        if (!query) return true;
        const version = q.currentVersion;
        return (
          stemOf(q).toLowerCase().includes(query) ||
          (version?.chapter ?? "").toLowerCase().includes(query) ||
          (version?.subject ?? "").toLowerCase().includes(query)
        );
      })
      .slice(0, 200);
  }, [questions, memberSet, pickerQuery]);

  /** Replaces a cluster in local state with the server's authoritative copy. */
  function applyCluster(next: ClusterView) {
    setClusters((prev) => prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
  }

  async function loadCluster(clusterId: string) {
    setSelectedId(clusterId);
    // Members are only fetched on open — the list endpoint returns counts only.
    const res = await apiJson<{ cluster: ClusterView }>(
      `/api/teacher/workspaces/${workspaceId}/clusters/${clusterId}`,
      { method: "GET" },
    );
    if (res.ok && res.data?.cluster) applyCluster(res.data.cluster);
  }

  async function patch(action: string, payload: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    const res = await apiJson<{ cluster: ClusterView }>(
      `/api/teacher/workspaces/${workspaceId}/clusters/${selected.id}`,
      { method: "PATCH", json: { action, ...payload } },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(res.detail || "That change could not be saved.");
      return null;
    }
    if (res.data?.cluster) applyCluster(res.data.cluster);
    return res.data?.cluster ?? null;
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const res = await apiJson<{ cluster: ClusterView }>(
      `/api/teacher/workspaces/${workspaceId}/clusters`,
      { method: "POST", json: { name } },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(res.detail || "Could not create that cluster.");
      return;
    }
    const created = res.data?.cluster;
    if (!created) {
      toast.error("Could not create that cluster.");
      return;
    }
    setClusters((prev) => [created, ...prev]);
    setSelectedId(created.id);
    setNewName("");
    setCreating(false);
    toast.success(`Cluster "${created.name}" created.`);
    router.refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete cluster "${selected.name}"? The questions themselves are not deleted.`)) return;
    setBusy(true);
    const res = await apiJson(`/api/teacher/workspaces/${workspaceId}/clusters/${selected.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.detail || "Could not delete that cluster.");
      return;
    }
    setClusters((prev) => prev.filter((c) => c.id !== selected.id));
    setSelectedId(null);
    toast.success("Cluster deleted. Its questions are still in your bag.");
    router.refresh();
  }

  async function handleAddPicked() {
    if (picked.length === 0) return;
    const updated = await patch("add-questions", { questionIds: picked });
    if (updated) {
      toast.success(`${picked.length} question${picked.length === 1 ? "" : "s"} added.`);
      setPicked([]);
      setPickerOpen(false);
    }
  }

  /** Moves a member one slot up or down and persists the whole new order. */
  async function move(questionId: string, direction: -1 | 1) {
    const ids = [...memberIds];
    const from = ids.indexOf(questionId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await patch("reorder", { orderedQuestionIds: ids });
  }

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ── Cluster list ─────────────────────────────────────────────────── */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card lg:col-span-2">
        <div className="shrink-0 space-y-3 border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Clusters</h3>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => setCreating((v) => !v)}
                className="h-8 gap-1 rounded-lg bg-primary font-bold text-black hover:bg-primary/95"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Group questions into a set you can stack straight into a paper. A question can sit in
            several clusters at once.
          </p>
          {creating && (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Cluster name"
                maxLength={120}
                className="h-9 rounded-xl text-xs"
              />
              <Button size="sm" onClick={handleCreate} disabled={busy || !newName.trim()} className="h-9 rounded-xl">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {clusters.length === 0 ? (
            <div className="p-8 text-center">
              <Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs font-semibold text-muted-foreground">No clusters yet.</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Create one here, or save a reviewed document import as a cluster.
              </p>
            </div>
          ) : (
            clusters.map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                onClick={() => loadCluster(cluster.id)}
                className={cn(
                  "mb-1 w-full rounded-xl border p-3 text-left transition-colors",
                  selectedId === cluster.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-bold">{cluster.name}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums">
                    {cluster.questionCount}
                  </span>
                </div>
                {cluster.sourceImportJobId && (
                  <span className="mt-1 inline-block text-[10px] text-muted-foreground">From a document import</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Cluster detail ───────────────────────────────────────────────── */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card lg:col-span-3">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <Layers className="mx-auto mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">Select a cluster</p>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b p-4">
              {renaming ? (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    maxLength={120}
                    className="h-9 rounded-xl text-sm font-bold"
                  />
                  <Textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="min-h-[60px] rounded-xl text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 rounded-lg"
                      disabled={busy || !draftName.trim()}
                      onClick={async () => {
                        const updated = await patch("update", {
                          name: draftName.trim(),
                          description: draftDescription.trim() || null,
                        });
                        if (updated) {
                          setRenaming(false);
                          toast.success("Cluster updated.");
                        }
                      }}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setRenaming(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{selected.name}</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {memberIds.length} question{memberIds.length === 1 ? "" : "s"}
                      {selected.description ? ` · ${selected.description}` : ""}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => {
                          setDraftName(selected.name);
                          setDraftDescription(selected.description ?? "");
                          setRenaming(true);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg p-0 text-destructive"
                        onClick={handleDelete}
                        title="Delete cluster"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {canEdit && !renaming && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="h-8 gap-1 rounded-lg text-xs"
                    onClick={() => setPickerOpen((v) => !v)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add from bag
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 rounded-lg text-xs"
                    onClick={() => onCreateQuestionForCluster(selected.id)}
                  >
                    <Plus className="h-3.5 w-3.5" /> New question
                  </Button>
                </div>
              )}
            </div>

            {/* Add-from-bag picker */}
            {pickerOpen && canEdit && (
              <div className="shrink-0 border-b bg-muted/30 p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search your question bag…"
                    className="h-8 rounded-lg pl-9 text-xs"
                  />
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {pickable.length === 0 ? (
                    <p className="p-3 text-center text-[11px] italic text-muted-foreground">
                      Every matching question is already in this cluster.
                    </p>
                  ) : (
                    pickable.map((question) => {
                      const active = picked.includes(question.id);
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() =>
                            setPicked((prev) =>
                              active ? prev.filter((id) => id !== question.id) : [...prev, question.id],
                            )
                          }
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg p-2 text-left transition-colors",
                            active ? "bg-primary/10" : "hover:bg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              active ? "border-primary bg-primary" : "border-muted-foreground/30",
                            )}
                          >
                            {active && <Check className="h-3 w-3 text-white" />}
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-[11px] leading-tight">{stemOf(question)}</span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              {question.currentVersion?.subject} · {question.currentVersion?.chapter}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setPickerOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    disabled={busy || picked.length === 0}
                    onClick={handleAddPicked}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Add ${picked.length || ""}`}
                  </Button>
                </div>
              </div>
            )}

            {/* Ordered members */}
            <div className="flex-1 overflow-y-auto p-3">
              {memberIds.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  This cluster is empty. Add questions from your bag, or create a new one straight into it.
                </p>
              ) : (
                memberIds.map((questionId, index) => {
                  const question = questionById.get(questionId);
                  return (
                    <div key={questionId} className="mb-1 flex items-start gap-2 rounded-xl border p-2.5">
                      <span className="mt-0.5 w-5 shrink-0 text-center text-[10px] font-bold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[11px] leading-tight">
                          {question ? stemOf(question) : "Question not in the current library view"}
                        </p>
                        {question && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {question.currentVersion?.subject} · {question.currentVersion?.chapter}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 rounded-md p-0"
                            disabled={busy || index === 0}
                            onClick={() => move(questionId, -1)}
                            title="Move up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 rounded-md p-0"
                            disabled={busy || index === memberIds.length - 1}
                            onClick={() => move(questionId, 1)}
                            title="Move down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 rounded-md p-0 text-destructive"
                            disabled={busy}
                            onClick={() => patch("remove-question", { questionId })}
                            title="Remove from cluster"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
