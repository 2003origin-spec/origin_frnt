"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, ArrowLeft, Layers, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/teacher-client";
import type { QuestionWithVersion, BatchWithCounts, AssessmentTest } from "@/server/workspaces/types";
import { toast } from "sonner";

import { QuestionPicker, type SelectedQuestion } from "./QuestionPicker";
import { TestSourceStackPanel } from "./TestSourceStackPanel";

export type WizardInitial = {
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  durationMinutes: number;
  marksPositive: number;
  marksNegative: number;
  selectedQuestions: SelectedQuestion[];
  status: string;
  shuffle: boolean;
  autoSubmit: boolean;
  hideLeaderboard: boolean;
};

type Props = {
  workspaceId: string;
  questions: QuestionWithVersion[];
  batches: BatchWithCounts[];
  ogcodeEnabled: boolean;
  /** `teacherDppShare` — hides the DPP delivery modes when the feature is dark. */
  dppShareEnabled?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  /** "edit" resumes an existing (draft) test, pre-filled from `initial`. */
  mode?: "create" | "edit";
  testId?: string;
  initial?: WizardInitial;
  /**
   * Sections of the full-mock blueprint this draft was created from, when it
   * has one. Purely advisory — the panel reports progress, nothing blocks
   * (plan D7).
   */
  blueprintSections?: BlueprintSection[] | null;
};

/** One blueprint section, as the wizard needs it. */
export type BlueprintSection = {
  id: string;
  label: string;
  plannedCount: number;
  marks: { correct: number; incorrect: number };
};

const STEPS = ["Details", "Select Questions", "Deliver"];

/**
 * How the finished paper reaches the batch.
 *
 * Until now this was not a choice: the wizard always published AND assigned a
 * scheduled test, so "share as DPP" could only ever be a second trip made after
 * the batch had already been given the same paper as an exam. A teacher who only
 * wanted to push practice had no route to it.
 *
 * `dpp` publishes but creates no assignment. Students discover teacher tests
 * exclusively through assignments (listTestPreviews → withAssignedTeacherTests),
 * so a published-but-unassigned paper never surfaces as an exam — which is what
 * makes DPP-only delivery safe without a new lifecycle state.
 *
 * Plan: V1/allmd/TEACHER_DPP_DELIVERY_AND_LIVE_SCORING_PLAN.md (D1)
 */
type DeliveryMode = "test" | "dpp" | "both";

export function TestCreatorWizard({ workspaceId, questions, batches, ogcodeEnabled, dppShareEnabled = false, onSuccess, onCancel, mode = "create", testId, initial, blueprintSections }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [currentStep, setCurrentStep] = useState(0);
  const [pending, startTransition] = useTransition();

  // Step 1: Details (pre-filled in edit mode)
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "medium");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 60);
  const [marksPositive, setMarksPositive] = useState(initial?.marksPositive ?? 4);
  const [marksNegative, setMarksNegative] = useState(initial?.marksNegative ?? 1);

  // Step 2: Selected Questions (mixed-source: OG Code + Question Bag)
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>(initial?.selectedQuestions ?? []);

  /**
   * Appends a resolved source stack to the cart, skipping anything already in
   * it. Appending (rather than replacing) lets a teacher stack two documents in
   * separate passes, and the skip keeps the same question from being asked
   * twice in one paper — reuse across DIFFERENT tests stays perfectly fine.
   */
  const appendResolvedQuestions = (incoming: SelectedQuestion[]) => {
    setSelectedQuestions((prev) => {
      const seen = new Set(prev.map((q) => `${q.sourceBank}:${q.id}`));
      const additions = incoming.filter((q) => q.id && !seen.has(`${q.sourceBank}:${q.id}`));
      return [...prev, ...additions];
    });
  };

  // Step 3: Deliver (drafts have no assignment yet — teacher picks here)
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("test");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // DPP delivery targets every selected batch at once — unlike the scheduled
  // test, which the existing flow assigns to exactly one.
  const [dppBatchIds, setDppBatchIds] = useState<string[]>([]);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  const sendsTest = deliveryMode === "test" || deliveryMode === "both";
  const sendsDpp = dppShareEnabled && (deliveryMode === "dpp" || deliveryMode === "both");

  const toggleDppBatch = (batchId: string) =>
    setDppBatchIds((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId],
    );
  const [shuffle, setShuffle] = useState(initial?.shuffle ?? true);
  const [autoSubmit, setAutoSubmit] = useState(initial?.autoSubmit ?? true);
  const [hideLeaderboard, setHideLeaderboard] = useState(initial?.hideLeaderboard ?? false);

  const nextStep = () => {
    if (currentStep === 0) {
      if (!title.trim() || !subject.trim()) {
        toast.error("Test Title and Subject are required.");
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (selectedQuestions.length === 0) {
        toast.error("Please select at least one question for the test.");
        return;
      }
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  async function submit() {
    // A scheduled test needs a batch and a window; a DPP needs neither — it just
    // needs somewhere to go.
    if (sendsTest && !selectedBatchId) {
      toast.error("Please select a target batch.");
      return;
    }
    if (sendsTest && (!startDate || !endDate)) {
      toast.error("Please specify a scheduled window.");
      return;
    }
    if (sendsDpp && dppBatchIds.length === 0) {
      toast.error("Select at least one batch to share the DPP with.");
      return;
    }

    startTransition(async () => {
      // Per-question source + marks (mixed OG Code + Question Bag).
      const questionsPayload = selectedQuestions.map((q, idx) => ({
        position: idx + 1,
        sourceBank: q.sourceBank,
        ogcodeQuestionId: q.sourceBank === "ogcode" ? q.id : null,
        contentQuestionId: q.sourceBank === "workspace_bag" ? q.id : null,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        sectionId: q.sectionId,
      }));

      const testPayload = {
        title: title.trim(),
        description: description.trim() || null,
        subject: subject.trim(),
        difficulty,
        durationMinutes: Number(duration),
        scoringPolicy: { positive: marksPositive, negative: marksNegative },
        settings: { shuffle, autoSubmit, hideLeaderboard },
        questions: questionsPayload,
      };

      // 1. Create (new) or update (resume an existing draft) the test + its questions.
      let resolvedTestId: string;
      if (isEdit && testId) {
        const patchResult = await apiJson(
          `/api/teacher/workspaces/${workspaceId}/tests/${testId}`,
          { method: "PATCH", json: testPayload },
        );
        if (!patchResult.ok) {
          toast.error(patchResult.detail || "Failed to save test");
          return;
        }
        resolvedTestId = testId;
      } else {
        const testResult = await apiJson<{ test: AssessmentTest }>(
          `/api/teacher/workspaces/${workspaceId}/tests`,
          { method: "POST", json: testPayload },
        );
        if (!testResult.ok) {
          toast.error(testResult.detail || "Failed to create test");
          return;
        }
        resolvedTestId = testResult.data.test.id;
      }

      // 2. Publish (draft/scheduled → published) so enrolled students can see it.
      const needsPublish = !isEdit || initial?.status === "draft" || initial?.status === "scheduled";
      if (needsPublish) {
        const publishResult = await apiJson(
          `/api/teacher/workspaces/${workspaceId}/tests/${resolvedTestId}/schedule?action=publish`,
          { method: "POST" }
        );
        if (!publishResult.ok) {
          toast.error(publishResult.detail || "Failed to publish test");
          return;
        }
      }

      const assignUrl = `/api/teacher/workspaces/${workspaceId}/tests/${resolvedTestId}/assign`;

      // 3. Assign to the batch with the scheduled window (batchIds is an array).
      //    Skipped entirely in DPP-only mode — no assignment row is what keeps
      //    the paper from showing up as an exam.
      if (sendsTest) {
        const assignResult = await apiJson(assignUrl, {
          method: "POST",
          json: {
            batchIds: [selectedBatchId],
            scheduledStartAt: new Date(startDate).toISOString(),
            scheduledEndAt: new Date(endDate).toISOString(),
          },
        });

        if (!assignResult.ok) {
          toast.error(assignResult.detail || "Failed to assign test to batch");
          return;
        }
      }

      // 4. Share as a DPP. Same endpoint, `action: "share_dpp"` — the paper lands
      //    in every selected batch's students' DPP section for 30 days.
      if (sendsDpp) {
        const shareResult = await apiJson(assignUrl, {
          method: "POST",
          json: { action: "share_dpp", batchIds: dppBatchIds, showAllQuestions },
        });

        if (!shareResult.ok) {
          // In "both" mode the test half has already landed, so say what did and
          // did not happen rather than implying the whole thing failed.
          toast.error(
            sendsTest
              ? `Test assigned, but the DPP share failed: ${shareResult.detail || "unknown error"}`
              : shareResult.detail || "Failed to share this test as a DPP.",
          );
          if (sendsTest) {
            onSuccess();
            router.refresh();
          }
          return;
        }
      }

      toast.success(
        sendsTest && sendsDpp
          ? "Published — assigned as a scheduled test and shared as a DPP."
          : sendsDpp
            ? "Shared as a DPP — it is in your students' DPP section for 30 days."
            : "Test published and assigned — your students can see it now.",
      );
      onSuccess();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* WizardProgressHeader */}
      <div className="flex items-center justify-between border-b pb-4 shrink-0">
        <h3 className="font-bold text-lg">{isEdit ? "Edit Test" : "Create Scheduled Test"}</h3>
        <div className="flex gap-2 text-xs font-semibold text-muted-foreground">
          {STEPS.map((s, idx) => {
            const isActive = currentStep === idx;
            const isDone = currentStep > idx;
            return (
              <span key={s} className={`flex items-center gap-1.5 ${
                isActive ? "text-primary font-bold" : isDone ? "text-emerald-500" : ""
              }`}>
                {isDone ? <Check className="w-3.5 h-3.5" /> : <span>{idx + 1}</span>}
                {s}
                {idx < STEPS.length - 1 && <span className="text-muted-foreground/30">/</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Wizard step contents */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 0 && (
            /* Step 1: Details form */
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-base">Test Settings & Policies</CardTitle>
                <CardDescription>Specify name, duration, and grading configurations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="t-title">Test Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} id="t-title" placeholder="JEE Practice Mock - Electrostatics" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-desc">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} id="t-desc" placeholder="Review formulas and Coulomb's law topics..." rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-sub">Subject *</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} id="t-sub" placeholder="Physics" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-diff">Difficulty</Label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="insane">Insane</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-dur">Duration (Minutes)</Label>
                    <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} id="t-dur" min={5} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-pos">Correct Marks (+)</Label>
                    <Input type="number" value={marksPositive} onChange={(e) => setMarksPositive(Number(e.target.value))} id="t-pos" min={1} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-neg">Negative Marks (-)</Label>
                    <Input type="number" value={marksNegative} onChange={(e) => setMarksNegative(Number(e.target.value))} id="t-neg" min={0} />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
                  <Button onClick={nextStep} className="bg-primary hover:bg-primary/95 text-black font-bold gap-1 rounded-xl">
                    Select Questions <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            /* Step 2: mixed-source question picker (OG Code + Question Bag),
               plus bulk stacking from whole documents / topics / past tests. */
            <div className="space-y-4">
              {blueprintSections && blueprintSections.length > 0 && (
                <BlueprintScaffold sections={blueprintSections} selected={selectedQuestions} />
              )}
              <TestSourceStackPanel workspaceId={workspaceId} testId={testId} onResolved={appendResolvedQuestions} />
              <QuestionPicker
                value={selectedQuestions}
                onChange={setSelectedQuestions}
                workspaceId={workspaceId}
                bagQuestions={questions}
                ogcodeEnabled={ogcodeEnabled}
                defaultMarks={marksPositive}
                defaultNegativeMarks={marksNegative}
                excludeTestId={isEdit ? testId : undefined}
              />
              <div className="flex justify-between border-t pt-4">
                <Button variant="outline" onClick={prevStep} className="rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={nextStep} disabled={selectedQuestions.length === 0} className="bg-primary hover:bg-primary/95 text-black font-bold gap-1 rounded-xl">
                  Schedule Window <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            /* Step 3: Deliver — as a scheduled test, as a DPP, or both. */
            <Card className="border">
              <CardHeader>
                <CardTitle className="text-base">Deliver this paper</CardTitle>
                <CardDescription>
                  Send it to your batches as a timed exam, as daily practice, or both.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {dppShareEnabled ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([
                      { id: "test", title: "Scheduled test", blurb: "A timed exam in a window you set." },
                      { id: "dpp", title: "DPP only", blurb: "Practice set for 30 days. No exam." },
                      { id: "both", title: "Both", blurb: "Sit the exam, keep it as practice." },
                    ] as const).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDeliveryMode(option.id)}
                        aria-pressed={deliveryMode === option.id}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          deliveryMode === option.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "hover:border-primary/40 hover:bg-muted/10"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.blurb}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {sendsTest ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="t-batch">Target Classroom Batch *</Label>
                      <select
                        id="t-batch"
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        required
                        className="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select a batch...</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.studentCount} students)</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="t-start">Scheduled Start Date/Time *</Label>
                        <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} id="t-start" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="t-end">Scheduled End Date/Time *</Label>
                        <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} id="t-end" required />
                      </div>
                    </div>
                  </>
                ) : null}

                {sendsDpp ? (
                  <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
                    <div>
                      <Label className="text-sm font-semibold">DPP batches *</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Appears in each student&apos;s DPP section under your institute&apos;s name,
                        live for 30 days.
                      </p>
                    </div>
                    {batches.length === 0 ? (
                      <p className="py-2 text-sm text-muted-foreground">
                        No active batches yet. Create a batch first.
                      </p>
                    ) : (
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {batches.map((b) => (
                          <label
                            key={b.id}
                            className="flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 hover:border-primary/40"
                          >
                            <Checkbox
                              checked={dppBatchIds.includes(b.id)}
                              onCheckedChange={() => toggleDppBatch(b.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{b.name}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {b.studentCount} student{b.studentCount === 1 ? "" : "s"}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3">
                      <Checkbox
                        checked={showAllQuestions}
                        onCheckedChange={(c) => setShowAllQuestions(!!c)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">Institute mode</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Show all questions at once (worksheet). Off = one question at a time.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}

                {/* Proctoring only means something for a timed exam — a DPP is
                    untimed practice with no leaderboard of its own. */}
                <div className={`space-y-3 pt-4 border-t ${sendsTest ? "" : "hidden"}`}>
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Proctoring & Delivery Toggles</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium">
                    <label className="flex items-center gap-2.5 border rounded-xl p-3 cursor-pointer hover:bg-muted/10">
                      <Checkbox checked={shuffle} onCheckedChange={(c) => setShuffle(!!c)} />
                      <div className="flex flex-col">
                        <span>Shuffle Questions</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Prevent student copying</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2.5 border rounded-xl p-3 cursor-pointer hover:bg-muted/10">
                      <Checkbox checked={autoSubmit} onCheckedChange={(c) => setAutoSubmit(!!c)} />
                      <div className="flex flex-col">
                        <span>Auto-Submit</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Enforce strict timer limit</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2.5 border rounded-xl p-3 cursor-pointer hover:bg-muted/10">
                      <Checkbox checked={hideLeaderboard} onCheckedChange={(c) => setHideLeaderboard(!!c)} />
                      <div className="flex flex-col">
                        <span>Suppress Leaderboard</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Hide active rankings</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={prevStep} disabled={pending} className="rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>
                  <Button 
                    onClick={() => startTransition(() => submit())} 
                    disabled={pending}
                    className="bg-primary hover:bg-primary/95 text-black font-bold rounded-xl gap-1.5"
                  >
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {sendsTest && sendsDpp
                      ? "Publish as Test + DPP"
                      : sendsDpp
                        ? "Publish as DPP"
                        : "Confirm & Publish Test"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}

/**
 * The exam's sectional architecture, with live progress against what is in the
 * cart. Advisory only — it tells the teacher what a real paper looks like and
 * how far along they are, and never blocks saving (plan D7).
 */
function BlueprintScaffold({
  sections,
  selected,
}: {
  sections: BlueprintSection[];
  selected: SelectedQuestion[];
}) {
  const bySection = new Map<string, number>();
  for (const question of selected) {
    if (question.sectionId) bySection.set(question.sectionId, (bySection.get(question.sectionId) ?? 0) + 1);
  }
  const planned = sections.reduce((sum, s) => sum + s.plannedCount, 0);
  const placed = sections.reduce((sum, s) => sum + (bySection.get(s.id) ?? 0), 0);
  const unassigned = selected.length - placed;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold">Paper blueprint</h4>
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {placed} / {planned} placed
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        This is the architecture a real paper follows. Stack one cluster per section below and its
        questions land in that section with its marking. Nothing here is enforced — it is a guide.
      </p>
      <div className="space-y-1">
        {sections.map((section) => {
          const have = bySection.get(section.id) ?? 0;
          const full = have >= section.plannedCount;
          return (
            <div
              key={section.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[11px]"
            >
              <span className="min-w-0 truncate font-semibold">{section.label}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground">
                  +{section.marks.correct} / {section.marks.incorrect === 0 ? "0" : section.marks.incorrect}
                </span>
                <span
                  className={
                    "w-12 text-right font-bold tabular-nums " +
                    (full ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")
                  }
                >
                  {have} / {section.plannedCount}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {unassigned > 0 && (
        <p className="mt-3 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          {unassigned} question{unassigned === 1 ? "" : "s"} in this paper are not tied to a section —
          they will still be asked, grouped by subject.
        </p>
      )}
    </div>
  );
}
