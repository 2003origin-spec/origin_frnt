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
import { mutateJson } from "@/lib/csrf";
import {
  CBT_QUESTION_TYPES,
  type CbtQuestion,
  type CbtQuestionInput,
  type CbtQuestionType,
} from "@/lib/cbt/question-model";
import { parseNumericAnswer } from "@/lib/cbt/answer-format";

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

// A numerical answer that carries a unit (e.g. "3F", "9.8 m/s^2") is stored as
// numerical_with_units so it grades on the number with the unit as a display
// label. New imports arrive already split; this re-splits any legacy combined
// answer so the dialog opens it in the correct, saveable shape.
function seedNumericAnswer(q?: CbtQuestion | null): {
  questionType: CbtQuestionType;
  answerText: string;
  units: string;
} {
  const questionType = q?.questionType ?? "mcq";
  const answerText = q?.answer.answerText ?? "";
  const units = q?.answer.units ?? "";
  if (questionType === "numerical" && !units.trim()) {
    const parsed = parseNumericAnswer(answerText);
    if (parsed.kind === "number_unit") {
      return { questionType: "numerical_with_units", answerText: parsed.number, units: parsed.unit };
    }
  }
  return { questionType, answerText, units };
}

type Props = {
  initialQuestion?: CbtQuestion | null;
  trigger?: React.ReactNode;
  // When provided, saving calls this instead of the /api/cbt/questions endpoints
  // (used to publish an edited import question via the accept-override route).
  onCustomSubmit?: (payload: CbtQuestionInput) => Promise<{ ok: boolean; detail?: string }>;
  dialogTitle?: string;
  submitLabel?: string;
};

export function CbtQuestionEditorDialog({
  initialQuestion,
  trigger,
  onCustomSubmit,
  dialogTitle,
  submitLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const seed = seedNumericAnswer(initialQuestion);
  const [questionType, setQuestionType] = useState<CbtQuestionType>(seed.questionType);
  const [stem, setStem] = useState(initialQuestion?.stem ?? "");
  const [options, setOptions] = useState<string[]>(
    initialQuestion?.options.length ? initialQuestion.options.map((o) => o.text) : ["", ""],
  );
  const [correctOption, setCorrectOption] = useState<number>(initialQuestion?.answer.correctOption ?? 0);
  const [correctOptions, setCorrectOptions] = useState<number[]>(initialQuestion?.answer.correctOptions ?? []);
  const [answerText, setAnswerText] = useState<string>(seed.answerText);
  const [tolerance, setTolerance] = useState<string>(
    initialQuestion?.answer.tolerance != null ? String(initialQuestion.answer.tolerance) : "0",
  );
  const [units, setUnits] = useState<string>(seed.units);
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
    } as CbtQuestionInput;
    startTransition(async () => {
      if (onCustomSubmit) {
        const result = await onCustomSubmit(payload);
        if (!result.ok) {
          setError(result.detail ?? "Save failed.");
          return;
        }
        setOpen(false);
        router.refresh();
        return;
      }
      const res = await mutateJson(
        initialQuestion ? `/api/cbt/questions/${initialQuestion.id}` : "/api/cbt/questions",
        {
          method: initialQuestion ? "PATCH" : "POST",
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

  // Switching to "Numerical with units" auto-splits a combined answer like "3F"
  // into the number ("3") + unit ("F") so the teacher doesn't split it by hand.
  function changeType(next: CbtQuestionType) {
    if (next === "numerical_with_units") {
      const parsed = parseNumericAnswer(answerText);
      if (parsed.kind === "number_unit") {
        setAnswerText(parsed.number);
        if (!units.trim()) setUnits(parsed.unit);
      }
    }
    setQuestionType(next);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5">New question</Button>}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle ?? (initialQuestion ? "Edit question" : "New question")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={questionType} onValueChange={(v) => changeType(v as CbtQuestionType)}>
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
              <div className="neu-inset rounded-xl p-3 text-sm">
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
              <Button type="button" size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" onClick={() => setOptions((p) => [...p, ""])}>
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
          <Button variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" onClick={save} disabled={pending || !stem.trim()}>
            {pending ? "Saving…" : submitLabel ?? "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
