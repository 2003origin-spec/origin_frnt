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

const CLASS_OPTIONS = [11, 12] as const;
const EXAM_OPTIONS = ["JEE", "NEET", "AIPMT"] as const;
const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40, 50] as const;

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
    exam: "" as "" | (typeof EXAM_OPTIONS)[number],
    subject: "mixed",
    chapter: "",
    questionCount: 10 as (typeof QUESTION_COUNT_OPTIONS)[number],
    durationMinutes: "" as "" | number,
  });
  const [facetChapters, setFacetChapters] = useState<string[]>([]);
  const [facetChaptersLoading, setFacetChaptersLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const chapterFacetReq = useRef(0);

  useEffect(() => {
    if (mode !== "auto") return;
    const req = ++chapterFacetReq.current;
    setFacetChaptersLoading(true);
    const qs = new URLSearchParams();
    qs.set("level", "chapter");
    if (autoConfig.classLevel) qs.append("classes", String(autoConfig.classLevel));
    if (autoConfig.exam) qs.append("occurrences", autoConfig.exam);
    if (autoConfig.subject !== "mixed") qs.append("subjects", autoConfig.subject);

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
  }, [mode, autoConfig.classLevel, autoConfig.exam, autoConfig.subject]);

  async function generateFromOgcode() {
    setGenerating(true);
    setError(null);
    try {
      const result = await apiJson<OgcodeAutoSelection>(
        `/api/teacher/workspaces/${workspaceId}/ogcode-auto-select`,
        {
          method: "POST",
          json: {
            subject: autoConfig.subject,
            chapter: autoConfig.chapter || undefined,
            class_level: autoConfig.classLevel || undefined,
            exam: autoConfig.exam || undefined,
            question_count: autoConfig.questionCount,
            duration_minutes: autoConfig.durationMinutes || undefined,
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  <Label>Exam</Label>
                  <select
                    value={autoConfig.exam}
                    onChange={(e) => setAutoConfig({ ...autoConfig, exam: e.target.value as "" | (typeof EXAM_OPTIONS)[number] })}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="">Any</option>
                    {EXAM_OPTIONS.map((exam) => (
                      <option key={exam} value={exam}>{exam}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <select
                    value={autoConfig.subject}
                    onChange={(e) => setAutoConfig({ ...autoConfig, subject: e.target.value, chapter: "" })}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="mixed">Mixed</option>
                    <option value="physics">Physics</option>
                    <option value="chemistry">Chemistry</option>
                    <option value="mathematics">Mathematics</option>
                    <option value="biology">Biology</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Chapter</Label>
                  <select
                    value={autoConfig.chapter}
                    onChange={(e) => setAutoConfig({ ...autoConfig, chapter: e.target.value })}
                    disabled={autoConfig.subject === "mixed" || facetChaptersLoading}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm disabled:opacity-50"
                  >
                    <option value="">
                      {autoConfig.subject === "mixed" ? "Pick a subject" : facetChaptersLoading ? "Loading…" : "Any"}
                    </option>
                    {facetChapters.map((chapter) => (
                      <option key={chapter} value={chapter}>{chapter}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Question count</Label>
                <div className="grid grid-cols-5 gap-2">
                  {QUESTION_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setAutoConfig({ ...autoConfig, questionCount: count })}
                      className={`h-9 rounded-lg border text-sm font-medium transition-colors ${
                        autoConfig.questionCount === count
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:border-primary/40"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Duration override (min, optional)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Auto"
                  value={autoConfig.durationMinutes}
                  onChange={(e) =>
                    setAutoConfig({ ...autoConfig, durationMinutes: e.target.value ? Math.max(1, Number(e.target.value)) : "" })
                  }
                />
              </div>

              {autoConfig.chapter ? (
                <p className="text-xs text-muted-foreground">
                  Short on questions in this chapter? We&apos;ll fill the rest from other {autoConfig.subject} chapters automatically.
                </p>
              ) : null}

              <Button type="button" onClick={generateFromOgcode} disabled={generating} variant="secondary" className="w-full">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate {autoConfig.questionCount} questions
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
