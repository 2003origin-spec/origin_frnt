"use client";

/**
 * Phase 15 — build a test in place for a teacher room.
 *
 * Reuses the shared QuestionPicker (mix OG Code + Question Bag). On submit it
 * creates a draft teacher test and immediately attaches it to the room via the
 * existing configure-test route — zero new backend. The take/grade path resolves
 * mixed sources (Phase 0), so the room runs the test correctly.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { apiJson } from "@/lib/teacher-client";
import type {
  AssessmentTest,
  QuestionWithVersion,
  TeacherRoomSummary,
} from "@/server/workspaces/types";
import { toast } from "sonner";

import { QuestionPicker, type SelectedQuestion } from "./QuestionPicker";
import { normalizeSubject } from "@/lib/entitlements";
import {
  resolveEqualCounts,
  computeDurationMinutes,
  computeMaxScore,
  totalQuestions,
  examMode,
  hmsToMinutes,
  clampHms,
  formatHms,
  BUILDER_EXAMS,
  EXAM_SUBJECTS,
  EXAM_LABELS,
  DEFAULT_SECONDS_PER_QUESTION,
  MIN_QUESTIONS_PER_SUBJECT,
  MAX_QUESTIONS_PER_SUBJECT,
  MIN_SECONDS_PER_QUESTION,
  MAX_SECONDS_PER_QUESTION,
  type SubjectCounts,
  type BuilderExam,
  type Hms,
} from "@/lib/subject-test-plan";

const CLASS_OPTIONS = [11, 12] as const;
const SUBJECT_OPTIONS = [
  { value: "physics", label: "Physics" },
  { value: "chemistry", label: "Chemistry" },
  { value: "mathematics", label: "Mathematics" },
  { value: "biology", label: "Biology" },
] as const;

type OgcodeAutoSelection = {
  questionIds: string[];
  subject: string;
  chapter: string | null;
  difficulty: string;
  durationMinutes: number;
};

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
  bagQuestions: QuestionWithVersion[];
  ogcodeEnabled: boolean;
};

export function RoomTestBuilderDrawer({ workspaceId, room, bagQuestions, ogcodeEnabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState<SelectedQuestion[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Auto-build filters — same class/exam/subject/chapter/count/duration model
  // as the student Test section's builder, reusing the same
  // /api/assessments/ogcode/facets endpoint for the chapter cascade.
  const [autoConfig, setAutoConfig] = useState({
    classLevel: "" as "" | (typeof CLASS_OPTIONS)[number],
    // Exam preset chip (JEE/NEET) — presets subjects + ratio; all unlocked for
    // the teacher (workspace membership is the authz on the route).
    exam: null as BuilderExam | null,
    subjects: [] as string[],
    chapter: "",
    sameForAll: true,
    baseCount: 10,
    perSubjectCounts: {} as Record<string, number>,
    // Time: fixed total exam time (hh:mm:ss, default) OR per-question timer.
    timeMode: "total" as "perQuestion" | "total",
    secondsPerQuestion: DEFAULT_SECONDS_PER_QUESTION,
    totalTime: { h: 0, m: 30, s: 0 } as Hms,
  });
  const [facetChapters, setFacetChapters] = useState<string[]>([]);
  const [facetChaptersLoading, setFacetChaptersLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const chapterFacetReq = useRef(0);

  // Chapter picking only makes sense for a single subject; with a multi-subject
  // mix we skip it (the selection tops up across chapters per subject anyway).
  const singleSubject = autoConfig.subjects.length === 1 ? autoConfig.subjects[0] : null;

  useEffect(() => {
    if (mode !== "auto") return;
    const req = ++chapterFacetReq.current;
    setFacetChaptersLoading(true);
    const qs = new URLSearchParams();
    qs.set("level", "chapter");
    if (autoConfig.classLevel) qs.append("classes", String(autoConfig.classLevel));
    if (autoConfig.exam) qs.append("occurrences", autoConfig.exam);
    if (singleSubject) qs.append("subjects", singleSubject);

    fetch(`/api/assessments/ogcode/facets?${qs.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (req !== chapterFacetReq.current) return;
        const values = Array.isArray(data) ? (data as string[]) : [];
        setFacetChapters(values);
        setAutoConfig((prev) => (prev.chapter && !values.includes(prev.chapter) ? { ...prev, chapter: "" } : prev));
      })
      .catch(() => {
        if (req === chapterFacetReq.current) setFacetChapters([]);
      })
      .finally(() => {
        if (req === chapterFacetReq.current) setFacetChaptersLoading(false);
      });
  }, [mode, autoConfig.classLevel, autoConfig.exam, singleSubject]);

  // Exam → mode for the double-Biology rule (NEET doubles Biology). No exam
  // selected → plain equal split (jee).
  const autoMode = autoConfig.exam ? examMode(autoConfig.exam) : "jee";
  const autoResolvedCounts: SubjectCounts = (() => {
    if (!autoConfig.subjects.length) return {};
    if (autoConfig.sameForAll) return resolveEqualCounts(autoConfig.subjects, autoConfig.baseCount, autoMode);
    const out: SubjectCounts = {};
    for (const raw of autoConfig.subjects) {
      const subject = normalizeSubject(raw);
      if (!subject) continue;
      const n = autoConfig.perSubjectCounts[subject] ?? autoConfig.baseCount;
      out[subject] = Math.max(MIN_QUESTIONS_PER_SUBJECT, Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.trunc(Number(n) || 0)));
    }
    return out;
  })();
  const autoTotalQ = totalQuestions(autoResolvedCounts);
  const autoDurationMin = autoConfig.timeMode === "total"
    ? hmsToMinutes(autoConfig.totalTime)
    : computeDurationMinutes(autoResolvedCounts, autoConfig.secondsPerQuestion);
  const autoMaxScore = computeMaxScore(autoResolvedCounts);

  // Tapping an exam chip presets subjects + ratio (still editable). Tapping the
  // active one clears it.
  const selectAutoExam = (exam: BuilderExam) => {
    setAutoConfig((prev) => prev.exam === exam
      ? { ...prev, exam: null }
      : { ...prev, exam, subjects: [...EXAM_SUBJECTS[exam]], chapter: "", sameForAll: true, perSubjectCounts: {} });
  };

  async function generateFromOgcode() {
    if (!autoConfig.subjects.length || autoTotalQ <= 0) {
      toast.error("Pick at least one subject and set a question count.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await apiJson<OgcodeAutoSelection>(
        `/api/teacher/workspaces/${workspaceId}/ogcode-auto-select`,
        {
          method: "POST",
          json: {
            subjects: autoConfig.subjects,
            subject_question_counts: autoResolvedCounts as Record<string, number>,
            chapter: singleSubject ? autoConfig.chapter || undefined : undefined,
            class_level: autoConfig.classLevel || undefined,
            exam: autoConfig.exam ? EXAM_LABELS[autoConfig.exam] : undefined,
            ...(autoConfig.timeMode === "total"
              ? { duration_minutes: hmsToMinutes(autoConfig.totalTime) }
              : { seconds_per_question: autoConfig.secondsPerQuestion }),
          },
        },
      );
      if (!result.ok) {
        toast.error(result.detail || "Could not generate questions for that configuration.");
        return;
      }
      const generated: SelectedQuestion[] = result.data.questionIds.map((id, index) => ({
        sourceBank: "ogcode",
        id,
        label: `OG Code question ${index + 1}`,
        marks: 4,
        negativeMarks: 1,
      }));
      setQuestions(generated);
      if (!title.trim()) {
        const subjectLabel = result.data.subject === "mixed" ? "Mixed" : result.data.subject[0].toUpperCase() + result.data.subject.slice(1);
        setTitle(`${subjectLabel} Auto-Built Test`);
      }
      setSubject(result.data.subject);
      setDifficulty(result.data.difficulty);
      setDuration(result.data.durationMinutes);
      toast.success(`Generated ${generated.length} questions.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate questions.");
    } finally {
      setGenerating(false);
    }
  }

  const disabled = room.status !== "lobby";

  function submit() {
    if (!title.trim()) {
      toast.error("Test title is required.");
      return;
    }
    if (questions.length === 0) {
      toast.error("Add at least one question.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const created = await apiJson<{ test: AssessmentTest }>(
        `/api/teacher/workspaces/${workspaceId}/tests`,
        {
          method: "POST",
          json: {
            title: title.trim(),
            subject: subject.trim() || "mixed",
            difficulty,
            durationMinutes: Number(duration),
            questions: questions.map((q, idx) => ({
              position: idx + 1,
              sourceBank: q.sourceBank,
              ogcodeQuestionId: q.sourceBank === "ogcode" ? q.id : null,
              contentQuestionId: q.sourceBank === "workspace_bag" ? q.id : null,
              marks: q.marks,
              negativeMarks: q.negativeMarks,
            })),
          },
        },
      );
      if (!created.ok) {
        setError(created.detail);
        return;
      }
      const attach = await apiJson<{ room: TeacherRoomSummary }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/configure-test`,
        { method: "POST", json: { teacherTestId: created.data.test.id } },
      );
      if (!attach.ok) {
        setError(attach.detail);
        return;
      }
      toast.success("Room test built and attached!");
      setOpen(false);
      setTitle("");
      setQuestions([]);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button disabled={disabled}>
          {room.teacherTestId ? "Build new test" : "Build test for room"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Build a test for this room</SheetTitle>
          <SheetDescription>
            Mix OG Code and your Question Bag. The test is created and attached to this room in
            one step.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Rapid Fire — Electrostatics"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Physics"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="insane">Insane</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>

          {ogcodeEnabled ? (
            <div className="flex gap-2 rounded-xl border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "manual" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pick manually
              </button>
              <button
                type="button"
                onClick={() => setMode("auto")}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "auto" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Auto-build from OG Code
              </button>
            </div>
          ) : null}

          {mode === "auto" && ogcodeEnabled ? (
            <div className="space-y-4 rounded-xl border p-4">
              {/* Exam preset — presets subjects + ratio (JEE 1:1:1, NEET Bio 2×). */}
              <div className="space-y-1.5">
                <Label>Exam preset</Label>
                <div className="flex flex-wrap gap-2">
                  {BUILDER_EXAMS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => selectAutoExam(ex)}
                      className={`h-9 px-4 rounded-lg border text-sm font-medium transition-colors ${
                        autoConfig.exam === ex ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40"
                      }`}
                    >
                      {EXAM_LABELS[ex]}
                    </button>
                  ))}
                  <span className="self-center text-xs text-muted-foreground">Optional — presets subjects &amp; ratio</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Class</Label>
                  <select
                    value={autoConfig.classLevel}
                    onChange={(e) =>
                      setAutoConfig({
                        ...autoConfig,
                        classLevel: e.target.value ? (Number(e.target.value) as (typeof CLASS_OPTIONS)[number]) : "",
                      })
                    }
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="">Any</option>
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Chapter</Label>
                  <select
                    value={autoConfig.chapter}
                    onChange={(e) => setAutoConfig({ ...autoConfig, chapter: e.target.value })}
                    disabled={!singleSubject || facetChaptersLoading}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm disabled:opacity-50"
                  >
                    <option value="">
                      {!singleSubject ? "Single subject only" : facetChaptersLoading ? "Loading…" : "Any"}
                    </option>
                    {facetChapters.map((chapter) => (
                      <option key={chapter} value={chapter}>{chapter}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subjects — multi-select; the teacher may build across any subjects. */}
              <div className="space-y-1.5">
                <Label>Subjects</Label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map((opt) => {
                    const active = autoConfig.subjects.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAutoConfig((prev) => ({
                          ...prev,
                          subjects: prev.subjects.includes(opt.value)
                            ? prev.subjects.filter((x) => x !== opt.value)
                            : [...prev.subjects, opt.value],
                          exam: null,
                          chapter: "",
                        }))}
                        className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          active ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject-wise question load. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Question load</Label>
                  <button
                    type="button"
                    onClick={() => setAutoConfig((prev) => ({ ...prev, sameForAll: !prev.sameForAll }))}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded border ${autoConfig.sameForAll ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
                    Same for all
                  </button>
                </div>
                {autoConfig.subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Pick one or more subjects to set the load.</p>
                ) : autoConfig.sameForAll ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={MIN_QUESTIONS_PER_SUBJECT}
                      max={MAX_QUESTIONS_PER_SUBJECT}
                      value={autoConfig.baseCount}
                      onChange={(e) => setAutoConfig((prev) => ({
                        ...prev,
                        baseCount: Math.max(MIN_QUESTIONS_PER_SUBJECT, Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.trunc(Number(e.target.value) || 0))),
                      }))}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">per subject{autoMode === "neet" && autoConfig.subjects.includes("biology") ? " · Biology 2× (NEET)" : ""}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {autoConfig.subjects.map((s) => {
                      const canonical = normalizeSubject(s) ?? s;
                      return (
                        <div key={s} className="flex items-center justify-between gap-2">
                          <span className="text-sm">{SUBJECT_OPTIONS.find((o) => o.value === canonical)?.label ?? canonical}</span>
                          <Input
                            type="number"
                            min={MIN_QUESTIONS_PER_SUBJECT}
                            max={MAX_QUESTIONS_PER_SUBJECT}
                            value={autoConfig.perSubjectCounts[canonical] ?? autoConfig.baseCount}
                            onChange={(e) => setAutoConfig((prev) => ({
                              ...prev,
                              perSubjectCounts: {
                                ...prev.perSubjectCounts,
                                [canonical]: Math.max(MIN_QUESTIONS_PER_SUBJECT, Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.trunc(Number(e.target.value) || 0))),
                              },
                            }))}
                            className="w-24"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Timing: per-question OR fixed total exam time. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Timing</Label>
                  <div className="inline-flex rounded-lg border p-0.5">
                    {(["total", "perQuestion"] as const).map((tm) => (
                      <button
                        key={tm}
                        type="button"
                        onClick={() => setAutoConfig((prev) => ({ ...prev, timeMode: tm }))}
                        className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                          autoConfig.timeMode === tm ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tm === "perQuestion" ? "Per question" : "Total time"}
                      </button>
                    ))}
                  </div>
                </div>
                {autoConfig.timeMode === "perQuestion" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={MIN_SECONDS_PER_QUESTION}
                      max={MAX_SECONDS_PER_QUESTION}
                      step={10}
                      value={autoConfig.secondsPerQuestion}
                      onChange={(e) => setAutoConfig((prev) => ({
                        ...prev,
                        secondsPerQuestion: Math.max(MIN_SECONDS_PER_QUESTION, Math.min(MAX_SECONDS_PER_QUESTION, Math.trunc(Number(e.target.value) || DEFAULT_SECONDS_PER_QUESTION))),
                      }))}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">sec / question</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {(["h", "m", "s"] as const).map((seg, i) => (
                      <div key={seg} className="flex items-center gap-2">
                        {i > 0 && <span className="text-sm font-bold text-muted-foreground">:</span>}
                        <Input
                          type="number"
                          min={0}
                          max={seg === "h" ? 6 : 59}
                          value={autoConfig.totalTime[seg]}
                          onChange={(e) => setAutoConfig((prev) => ({
                            ...prev,
                            totalTime: clampHms({ ...prev.totalTime, [seg]: Math.trunc(Number(e.target.value) || 0) }),
                          }))}
                          className="w-20 text-center"
                        />
                      </div>
                    ))}
                    <span className="text-xs text-muted-foreground">hh:mm:ss ({formatHms(clampHms(autoConfig.totalTime))})</span>
                  </div>
                )}
              </div>

              {autoConfig.subjects.length > 0 && autoTotalQ > 0 ? (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  {/* Subject-wise first. */}
                  <div className="space-y-1">
                    {autoConfig.subjects.map((s) => {
                      const canonical = normalizeSubject(s) ?? s;
                      const count = autoResolvedCounts[canonical as keyof SubjectCounts] ?? 0;
                      return (
                        <div key={s} className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium">{SUBJECT_OPTIONS.find((o) => o.value === canonical)?.label ?? canonical}</span>
                          <span className="font-semibold">{count} Q · {count * 4} marks</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Grand total. */}
                  <div className="flex items-center justify-between gap-3 pt-1.5 border-t text-xs font-semibold">
                    <span className="uppercase tracking-wide text-muted-foreground">Total</span>
                    <span>{autoTotalQ} question{autoTotalQ === 1 ? "" : "s"} · {autoDurationMin} min · {autoMaxScore} marks</span>
                  </div>
                  {autoConfig.chapter ? (
                    <p className="text-[11px] text-muted-foreground">Short on questions in this chapter? We&apos;ll top up from other {singleSubject} chapters.</p>
                  ) : null}
                </div>
              ) : null}

              <Button type="button" onClick={generateFromOgcode} disabled={generating || autoConfig.subjects.length === 0 || autoTotalQ <= 0} variant="secondary" className="w-full">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate {autoTotalQ} question{autoTotalQ === 1 ? "" : "s"}
              </Button>

              {questions.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {questions.length} question{questions.length === 1 ? "" : "s"} ready — review below, then Build &amp; attach.
                </p>
              ) : null}
            </div>
          ) : null}

          <QuestionPicker
            value={questions}
            onChange={setQuestions}
            workspaceId={workspaceId}
            bagQuestions={bagQuestions}
            ogcodeEnabled={ogcodeEnabled}
          />

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <SheetFooter className="gap-2">
          <Button onClick={submit} disabled={pending || disabled}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Build &amp; attach
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
