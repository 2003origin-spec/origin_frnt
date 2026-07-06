"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { csrfHeaders } from "@/lib/csrf";
import { CBT_QUESTION_TYPES, type CbtQuestion, type CbtQuestionType } from "@/lib/cbt/question-model";

const TYPE_LABELS: Record<CbtQuestionType, string> = {
  mcq: "MCQ (single correct)",
  msq: "MSQ (multi-select)",
  numerical: "Numerical",
  numerical_with_units: "Numerical with units",
  symbolic_expression: "Symbolic expression",
  equation: "Equation",
  matrix_match: "Matrix match",
  subjective: "Subjective",
};

const DIFFICULTIES = ["easy", "medium", "hard", "insane"];

type Props = {
  initialQuestion?: CbtQuestion | null;
  trigger?: React.ReactNode;
};

export function CbtQuestionEditorDialog({ initialQuestion, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [questionType, setQuestionType] = useState<CbtQuestionType>(initialQuestion?.questionType ?? "mcq");
  const [stem, setStem] = useState(initialQuestion?.stem ?? "");
  const [options, setOptions] = useState<string[]>(
    initialQuestion?.options.length ? initialQuestion.options.map((o) => o.text) : ["", ""],
  );
  const [correctOption, setCorrectOption] = useState<number>(initialQuestion?.answer.correctOption ?? 0);
  const [correctOptions, setCorrectOptions] = useState<number[]>(initialQuestion?.answer.correctOptions ?? []);
  const [answerText, setAnswerText] = useState<string>(initialQuestion?.answer.answerText ?? "");
  const [tolerance, setTolerance] = useState<string>(
    initialQuestion?.answer.tolerance != null ? String(initialQuestion.answer.tolerance) : "0",
  );
  const [units, setUnits] = useState<string>(initialQuestion?.answer.units ?? "");
  const [matrixJson, setMatrixJson] = useState<string>(
    initialQuestion?.answer.matrixData ? JSON.stringify(initialQuestion.answer.matrixData, null, 2) : "",
  );
  const [explanation, setExplanation] = useState(initialQuestion?.explanation ?? "");
  const [subject, setSubject] = useState(initialQuestion?.subject ?? "");
  const [chapter, setChapter] = useState(initialQuestion?.chapter ?? "");
  const [concept, setConcept] = useState(initialQuestion?.concept ?? "");
  const [difficulty, setDifficulty] = useState(initialQuestion?.difficulty ?? "medium");

  const usesOptions = questionType === "mcq" || questionType === "msq";
  const stemPreview = useMemo(() => stem, [stem]);

  function buildAnswer(): Record<string, unknown> {
    switch (questionType) {
      case "mcq":
        return { correctOption };
      case "msq":
        return { correctOptions };
      case "numerical":
        return { answerText, tolerance: Number(tolerance) || 0 };
      case "numerical_with_units":
        return { answerText, units, tolerance: Number(tolerance) || 0 };
      case "symbolic_expression":
      case "equation":
        return { answerText };
      case "matrix_match": {
        try {
          return { matrixData: matrixJson.trim() ? JSON.parse(matrixJson) : {} };
        } catch {
          return { matrixData: null };
        }
      }
      case "subjective":
        return answerText.trim() ? { answerText } : {};
      default:
        return {};
    }
  }

  function save() {
    setError(null);
    if (questionType === "matrix_match" && matrixJson.trim()) {
      try {
        JSON.parse(matrixJson);
      } catch {
        setError("Matrix data must be valid JSON.");
        return;
      }
    }
    const payload = {
      questionType,
      stem,
      options: usesOptions ? options.map((text) => ({ text })) : [],
      answer: buildAnswer(),
      explanation: explanation || null,
      subject: subject || null,
      chapter: chapter || null,
      concept: concept || null,
      difficulty: difficulty || null,
    };
    startTransition(async () => {
      const res = await fetch(
        initialQuestion ? `/api/cbt/questions/${initialQuestion.id}` : "/api/cbt/questions",
        {
          method: initialQuestion ? "PATCH" : "POST",
          headers: { "content-type": "application/json", ...csrfHeaders() },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(data.detail ?? `Save failed (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function toggleMsq(index: number) {
    setCorrectOptions((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">New question</Button>}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialQuestion ? "Edit question" : "New question"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={questionType} onValueChange={(v) => setQuestionType(v as CbtQuestionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CBT_QUESTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Question (supports $LaTeX$)</Label>
            <Textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={3} />
            {stemPreview.trim() ? (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-sm">
                <LatexRenderer content={stemPreview} />
              </div>
            ) : null}
          </div>

          {usesOptions ? (
            <div className="space-y-2">
              <Label>Options ({questionType === "mcq" ? "pick one correct" : "pick all correct"})</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  {questionType === "mcq" ? (
                    <input
                      type="radio"
                      name="cbt-correct"
                      checked={correctOption === i}
                      onChange={() => setCorrectOption(i)}
                    />
                  ) : (
                    <input type="checkbox" checked={correctOptions.includes(i)} onChange={() => toggleMsq(i)} />
                  )}
                  <Input
                    value={opt}
                    onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                    placeholder={`Option ${i + 1}`}
                  />
                  {options.length > 2 ? (
                    <button
                      type="button"
                      className="text-xs text-destructive"
                      onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setOptions((p) => [...p, ""])}>
                Add option
              </Button>
            </div>
          ) : null}

          {(questionType === "numerical" || questionType === "numerical_with_units") ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Answer</Label>
                <Input value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="e.g. 9.8" />
              </div>
              <div className="space-y-1">
                <Label>Tolerance (±)</Label>
                <Input value={tolerance} onChange={(e) => setTolerance(e.target.value)} placeholder="0" />
              </div>
              {questionType === "numerical_with_units" ? (
                <div className="space-y-1">
                  <Label>Units</Label>
                  <Input value={units} onChange={(e) => setUnits(e.target.value)} placeholder="m/s^2" />
                </div>
              ) : null}
            </div>
          ) : null}

          {(questionType === "symbolic_expression" || questionType === "equation") ? (
            <div className="space-y-1">
              <Label>Answer expression</Label>
              <Input value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="e.g. x^2 + 1" />
            </div>
          ) : null}

          {questionType === "matrix_match" ? (
            <div className="space-y-1">
              <Label>Matrix data (JSON)</Label>
              <Textarea
                value={matrixJson}
                onChange={(e) => setMatrixJson(e.target.value)}
                rows={5}
                placeholder='{ "left": ["A","B"], "right": ["P","Q"], "correct_pairs": [[0,1],[1,0]] }'
                className="font-mono text-xs"
              />
            </div>
          ) : null}

          {questionType === "subjective" ? (
            <div className="space-y-1">
              <Label>Model answer (optional)</Label>
              <Textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} rows={2} />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Chapter</Label>
              <Input value={chapter} onChange={(e) => setChapter(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Concept</Label>
              <Input value={concept} onChange={(e) => setConcept(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Explanation (optional)</Label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !stem.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
