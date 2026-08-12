"use client";

/**
 * Teacher-side full-length mock generator.
 *
 * Picks an exam pattern, generates the paper server-side from the same blueprint
 * the student presets use, and drops it into the workspace as a DRAFT — the
 * teacher then reviews, publishes and assigns it through the existing pipeline,
 * unchanged.
 *
 * Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md Phase 6.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiJson } from "@/lib/teacher-client";
import { cn } from "@/lib/utils";
import {
  EXAM_BLUEPRINTS,
  ALL_EXAM_PRESETS,
  blueprintTotalMarks,
  blueprintTotalQuestions,
  formatMarking,
  type ExamPresetId,
} from "@/lib/exam-blueprints";

export function FullLengthTestDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<ExamPresetId>("jee-main");
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);

  const blueprint = EXAM_BLUEPRINTS[preset];

  async function handleGenerate() {
    setGenerating(true);
    const res = await apiJson<{ test: { id: string; title: string }; adaptationSummary: string | null }>(
      `/api/teacher/workspaces/${workspaceId}/tests`,
      { method: "POST", json: { fullLength: { preset, title: title.trim() || undefined } } },
    );
    setGenerating(false);

    if (!res.ok) {
      toast.error(res.detail || "Could not generate that paper.");
      return;
    }
    setOpen(false);
    setTitle("");
    toast.success(`${blueprint.label} paper created as a draft.`, {
      description: res.data?.adaptationSummary ?? "Review it, then publish and assign to your batches.",
    });
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-10 w-full gap-1.5 rounded-xl font-semibold sm:w-auto"
      >
        <Wand2 className="h-4 w-4" />
        Generate Full Mock
      </Button>

      <Dialog open={open} onOpenChange={(next) => !generating && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate a full-length mock
            </DialogTitle>
            <DialogDescription>
              Builds a sectional paper from the OG Code bank on the real exam&apos;s pattern and marking.
              It is created as a draft — publish and assign it when you are happy with it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Exam pattern
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {ALL_EXAM_PRESETS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPreset(id)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-xs font-bold transition-all",
                      preset === id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {EXAM_BLUEPRINTS[id].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs font-bold text-foreground">
                {blueprintTotalQuestions(blueprint)} questions · {blueprintTotalMarks(blueprint)} marks ·{" "}
                {blueprint.durationMinutes} min
              </p>
              <ul className="mt-2 space-y-1">
                {blueprint.sections.map((section) => (
                  <li key={section.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-muted-foreground">{section.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground/80">
                      {section.count} · {formatMarking(section.marking)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full-mock-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Title (optional)
              </Label>
              <Input
                id="full-mock-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`${blueprint.label} Full Mock Test`}
                maxLength={200}
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={generating} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating} className="gap-1.5 rounded-xl font-semibold">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building paper…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate draft
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
