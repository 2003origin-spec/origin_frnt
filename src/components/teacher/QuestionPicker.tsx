"use client";

/**
 * Reusable mixed-source question picker (Phase 15). Controlled: the parent owns the
 * ordered selection (`value`/`onChange`). Two source tabs — Question Bag (the
 * workspace's `content.questions`) and OG Code (the shared bank, via the paginated
 * teacher browse) — feed one ordered cart with per-question marks and up/down/top
 * reordering. Used by the test-builder wizard and the room build-in-place drawer so
 * general tests and room tests share one authoring surface.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUp, Minus, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiJson } from "@/lib/teacher-client";
import type { QuestionWithVersion } from "@/server/workspaces/types";

import { OgcodeQuestionList } from "./OgcodeQuestionList";
import type { OgcodeBrowseItem } from "./useOgcodeBrowse";

export type SelectedQuestion = {
  sourceBank: "ogcode" | "workspace_bag";
  /** ogcode id for ogcode rows; content-question id for workspace_bag rows. */
  id: string;
  label: string;
  marks: number;
  negativeMarks: number;
  /**
   * Blueprint section this question belongs to, when it was stacked into a
   * full-mock draft. Carried through the cart so saving preserves the sectional
   * structure (plan D6).
   */
  sectionId?: string;
};

/** Where a bag question is already used, excluding the test being edited. */
type QuestionUsage = { testCount: number; titles: string[]; liveCount: number };

type Props = {
  value: SelectedQuestion[];
  onChange: (next: SelectedQuestion[]) => void;
  workspaceId: string;
  bagQuestions: QuestionWithVersion[];
  ogcodeEnabled: boolean;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  /** Excluded from the "already used in" counts when editing an existing test. */
  excludeTestId?: string;
};

export function QuestionPicker({
  value,
  onChange,
  workspaceId,
  bagQuestions,
  ogcodeEnabled,
  defaultMarks = 4,
  defaultNegativeMarks = 1,
  excludeTestId,
}: Props) {
  const [bagSearch, setBagSearch] = useState("");
  const [bagChapter, setBagChapter] = useState("");

  /**
   * Reuse visibility. A question living in several tests is allowed and always
   * has been — a teacher legitimately reuses one across a mock, a revision
   * paper and a retest, and every attempt snapshots its question so historical
   * results never move. Showing the count just removes the guesswork; the
   * `liveCount` warning is the part that matters, because editing a question a
   * live test is serving changes it under the students sitting it.
   */
  const [usage, setUsage] = useState<Record<string, QuestionUsage>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const query = excludeTestId ? `&excludeTestId=${encodeURIComponent(excludeTestId)}` : "";
      const res = await apiJson<{ usage: Record<string, QuestionUsage> }>(
        `/api/teacher/workspaces/${workspaceId}/tests?view=sources${query}`,
      );
      if (!cancelled && res.ok) setUsage(res.data.usage ?? {});
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, excludeTestId]);

  // Topics present in this workspace's bag (for the topic segregation dropdown).
  const bagChapters = useMemo(() => {
    const set = new Set<string>();
    for (const q of bagQuestions) {
      const c = q.currentVersion?.chapter?.trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [bagQuestions]);

  const selectedBagIds = useMemo(
    () => new Set(value.filter((q) => q.sourceBank === "workspace_bag").map((q) => q.id)),
    [value],
  );
  const selectedOgcodeIds = useMemo(
    () => new Set(value.filter((q) => q.sourceBank === "ogcode").map((q) => q.id)),
    [value],
  );

  function add(item: SelectedQuestion) {
    if (value.some((q) => q.sourceBank === item.sourceBank && q.id === item.id)) return;
    onChange([...value, item]);
  }
  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function moveToTop(index: number) {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
  }
  function updateMarks(index: number, field: "marks" | "negativeMarks", raw: number) {
    const next = value.map((q, i) => (i === index ? { ...q, [field]: raw } : q));
    onChange(next);
  }

  const filteredBag = bagQuestions.filter((q) => {
    if (selectedBagIds.has(q.id)) return false;
    const v = q.currentVersion;
    if (bagChapter && v?.chapter !== bagChapter) return false;
    const term = bagSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      (v?.stem.toLowerCase().includes(term) ?? false) ||
      (v?.chapter.toLowerCase().includes(term) ?? false) ||
      (v?.concept.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Source pane */}
      <div className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border bg-card">
        <Tabs defaultValue="bag" className="flex h-full flex-col">
          <div className="border-b p-3">
            <TabsList>
              <TabsTrigger value="bag">Question Bag</TabsTrigger>
              {ogcodeEnabled ? <TabsTrigger value="ogcode">OG Code</TabsTrigger> : null}
            </TabsList>
          </div>

          <TabsContent value="bag" className="flex-1 overflow-y-auto p-3">
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={bagSearch}
                  onChange={(e) => setBagSearch(e.target.value)}
                  placeholder="Search your question bag…"
                  className="h-9 pl-9 text-xs"
                />
              </div>
              {bagChapters.length > 0 ? (
                <select
                  value={bagChapter}
                  onChange={(e) => setBagChapter(e.target.value)}
                  className="h-8 w-full rounded-lg border bg-background px-2 text-xs"
                >
                  <option value="">All topics</option>
                  {bagChapters.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {filteredBag.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No matching questions in your bag.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredBag.map((q) => {
                  const used = usage[q.id];
                  return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium">{q.currentVersion?.stem}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>
                          {q.currentVersion?.chapter} · {q.currentVersion?.questionType.toUpperCase()}
                        </span>
                        {used && used.testCount > 0 ? (
                          <span
                            title={`Already in: ${used.titles.join(", ")}`}
                            className="rounded-full bg-muted px-1.5 py-0.5 font-medium"
                          >
                            in {used.testCount} test{used.testCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {used && used.liveCount > 0 ? (
                          <span
                            title="A test using this question is live right now — editing it changes the paper under the students sitting it."
                            className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" /> live
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 shrink-0 p-0 text-primary"
                      onClick={() =>
                        add({
                          sourceBank: "workspace_bag",
                          id: q.id,
                          label: q.currentVersion?.stem ?? "Question",
                          marks: defaultMarks,
                          negativeMarks: defaultNegativeMarks,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {ogcodeEnabled ? (
            <TabsContent value="ogcode" className="flex-1 overflow-y-auto p-3">
              <OgcodeQuestionList
                workspaceId={workspaceId}
                selectedIds={selectedOgcodeIds}
                renderAction={(item: OgcodeBrowseItem) => (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-primary"
                    disabled={selectedOgcodeIds.has(item.id)}
                    onClick={() =>
                      add({
                        sourceBank: "ogcode",
                        id: item.id,
                        label: item.text,
                        marks: defaultMarks,
                        negativeMarks: defaultNegativeMarks,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>

      {/* Cart pane */}
      <div className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/10 p-3">
          <Label className="text-xs font-bold uppercase text-primary">Test questions</Label>
          <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {value.length} selected
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {value.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Empty. Add questions from the left — mix OG Code and your Question Bag freely.
            </p>
          ) : (
            <div className="space-y-2">
              {value.map((q, idx) => (
                <div
                  key={`${q.sourceBank}:${q.id}`}
                  className="space-y-2 rounded-lg border p-2 text-xs"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <p className="line-clamp-2 flex-1 font-medium">{q.label}</p>
                    <Badge variant={q.sourceBank === "ogcode" ? "default" : "secondary"}>
                      {q.sourceBank === "ogcode" ? "OG" : "Bag"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        +
                        <Input
                          type="number"
                          value={q.marks}
                          min={0}
                          onChange={(e) => updateMarks(idx, "marks", Number(e.target.value))}
                          className="h-7 w-14 px-2 text-xs"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        −
                        <Input
                          type="number"
                          value={q.negativeMarks}
                          min={0}
                          onChange={(e) => updateMarks(idx, "negativeMarks", Number(e.target.value))}
                          className="h-7 w-14 px-2 text-xs"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx === 0}
                        onClick={() => moveToTop(idx)}
                        title="Move to top"
                      >
                        <ChevronsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx === value.length - 1}
                        onClick={() => move(idx, 1)}
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => removeAt(idx)}
                        title="Remove"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
