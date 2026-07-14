/**
 * GET   /api/admin/ogcode/questions/[questionId]  — full question for editing.
 * PATCH /api/admin/ogcode/questions/[questionId]   — save edited content (issue fix).
 * Admin-gated (requireRole).
 */
import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/server/authz";
import {
  getOgcodeCatalogQuestionById,
  updateOgcodeCatalogQuestion,
  type OgcodeQuestionEditFields,
} from "@/server/ogcode-catalog";
import { recordAuditEvent } from "@/server/workspaces/audit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  try {
    await requireRole(request, ["admin"]);
    const { questionId } = await params;
    const q = await getOgcodeCatalogQuestionById(questionId);
    if (!q) return NextResponse.json({ detail: "Question not found." }, { status: 404 });
    return NextResponse.json({
      question: {
        id: q.id,
        text: q.text,
        options: q.options,
        correctOption: q.correctOption,
        correctOptions: q.correctOptions,
        answerText: q.answerText,
        explanation: q.explanation,
        hint: q.hint,
        subject: q.subject,
        chapter: q.chapter,
        difficulty: q.difficulty,
        questionType: q.questionType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load question.";
    return NextResponse.json({ detail: message }, { status: 403 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  try {
    const ctx = await requireRole(request, ["admin"]);
    const { questionId } = await params;
    const body = (await request.json().catch(() => ({}))) as Partial<OgcodeQuestionEditFields>;
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ detail: "Question text is required." }, { status: 400 });
    }
    const fields: OgcodeQuestionEditFields = {
      text: body.text,
      options: Array.isArray(body.options) ? body.options.map((o) => String(o)) : null,
      correctOption: typeof body.correctOption === "number" ? body.correctOption : null,
      correctOptions: Array.isArray(body.correctOptions) ? body.correctOptions.map((n) => Number(n)) : null,
      answerText: body.answerText != null ? String(body.answerText) : null,
      explanation: typeof body.explanation === "string" ? body.explanation : "",
      hint: body.hint != null ? String(body.hint) : null,
      subject: typeof body.subject === "string" ? body.subject : "",
      chapter: typeof body.chapter === "string" ? body.chapter : "",
      difficulty: typeof body.difficulty === "string" ? body.difficulty : "medium",
    };
    const result = await updateOgcodeCatalogQuestion(questionId, fields);
    if (!result.ok) return NextResponse.json({ detail: "Question not found." }, { status: 404 });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "ogcode_question",
      entityId: questionId,
      action: "ogcode_question.edited",
      after: { text: fields.text, subject: fields.subject, difficulty: fields.difficulty },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save question.";
    return NextResponse.json({ detail: message }, { status: 403 });
  }
}
