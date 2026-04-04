import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUserFromRequest } from "@/server/auth";
import {
  commitOriginAiVoiceTurn,
  getOriginAiSnapshot,
  getOriginAiVoiceBootstrap,
  sendOriginAiMessage,
  type OriginAiPageContextInput,
} from "@/server/origin-ai";
import {
  badRequest,
  created,
  getSlugSegments,
  notFound,
  ok,
  parseJsonBody,
  unauthorized,
} from "@/server/http";
import { withStoreAsync } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionQuerySchema = z.object({
  pathname: z.string().optional(),
  pageKind: z.string().optional(),
  testId: z.string().optional(),
  questionId: z.string().optional(),
});

const visibleQuestionSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  chapter: z.string().nullable().optional(),
  concept: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isSolved: z.boolean().optional(),
});

const pageContextSchema = z.object({
  pathname: z.string().optional(),
  pageKind: z.string().optional(),
  testId: z.string().optional(),
  questionId: z.string().optional(),
  searchQuery: z.string().nullable().optional(),
  activeSubject: z.string().nullable().optional(),
  activeDifficulty: z.string().nullable().optional(),
  activeStatus: z.string().nullable().optional(),
  selectedChapters: z.array(z.string()).optional(),
  totalVisibleQuestions: z.number().int().nonnegative().nullable().optional(),
  visibleQuestions: z.array(visibleQuestionSchema).max(40).optional(),
});

const messageBodySchema = z.object({
  message: z.string().trim().min(1),
  pageContext: pageContextSchema.optional(),
});

const voiceBootstrapBodySchema = z.object({
  pageContext: pageContextSchema.optional(),
});

const voiceTurnBodySchema = z.object({
  userTranscript: z.string().trim().min(1),
  assistantTranscript: z.string().trim().min(1),
  liveSessionId: z.string().trim().nullable().optional(),
  responseId: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  transport: z.literal("gemini_live").optional(),
  interrupted: z.boolean().optional(),
  completionReason: z.enum(["turn_complete", "interrupted", "manual_stop", "unknown"]).optional(),
  assistantAudioChunkCount: z.number().int().nonnegative().optional(),
  assistantTranscriptChunkCount: z.number().int().nonnegative().optional(),
  hadOutputTranscript: z.boolean().optional(),
  pageContext: pageContextSchema.optional(),
});

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

async function resolveSlug(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return getSlugSegments(params);
}

function toPageContext(input?: Partial<z.infer<typeof pageContextSchema>>): OriginAiPageContextInput {
  return {
    pathname: input?.pathname ?? null,
    pageKind: (input?.pageKind as OriginAiPageContextInput["pageKind"]) ?? null,
    testId: input?.testId ?? null,
    questionId: input?.questionId ?? null,
    searchQuery: input?.searchQuery ?? null,
    activeSubject: input?.activeSubject ?? null,
    activeDifficulty: input?.activeDifficulty ?? null,
    activeStatus: input?.activeStatus ?? null,
    selectedChapters: input?.selectedChapters ?? null,
    totalVisibleQuestions: input?.totalVisibleQuestions ?? null,
    visibleQuestions: input?.visibleQuestions ?? null,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (slug.length !== 1 || slug[0] !== "session") {
    return notFound();
  }

  const parsedQuery = sessionQuerySchema.safeParse({
    pathname: request.nextUrl.searchParams.get("pathname") ?? undefined,
    pageKind: request.nextUrl.searchParams.get("pageKind") ?? undefined,
    testId: request.nextUrl.searchParams.get("testId") ?? undefined,
    questionId: request.nextUrl.searchParams.get("questionId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return badRequest("Invalid Origin AI page context.");
  }

  const result = await withStoreAsync(async (store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return { status: "unauthorized" as const };
    }
    const snapshot = await getOriginAiSnapshot(store, user, request, toPageContext(parsedQuery.data));
    return { status: "ok" as const, snapshot };
  });

  if (result.status === "unauthorized") {
    return unauthorized();
  }

  return ok(result.snapshot);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);

  try {
    const body = await parseJsonBody(request);
    if (slug.length === 2 && slug[0] === "session" && slug[1] === "message") {
      const parsedBody = messageBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Message is required.");
      }

      const result = await withStoreAsync(async (store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const reply = await sendOriginAiMessage(
          store,
          user,
          request,
          parsedBody.data.message,
          toPageContext(parsedBody.data.pageContext),
        );

        if ("error" in reply) {
          return { status: "error" as const, error: reply.error };
        }

        return { status: "created" as const, reply };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      if (result.status === "error") {
        return badRequest(result.error, { error: result.error });
      }

      return created(result.reply);
    }

    if (slug.length === 2 && slug[0] === "voice" && slug[1] === "bootstrap") {
      const parsedBody = voiceBootstrapBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Invalid voice bootstrap payload.");
      }

      const result = await withStoreAsync(async (store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const bootstrap = await getOriginAiVoiceBootstrap(
          store,
          user,
          request,
          toPageContext(parsedBody.data.pageContext),
        );

        if ("error" in bootstrap) {
          return { status: "error" as const, error: bootstrap.error };
        }

        return { status: "ok" as const, bootstrap };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      if (result.status === "error") {
        return badRequest(result.error, { error: result.error });
      }

      return ok(result.bootstrap);
    }

    if (slug.length === 2 && slug[0] === "voice" && slug[1] === "turn") {
      const parsedBody = voiceTurnBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return badRequest("Voice transcripts are required.");
      }

      const result = await withStoreAsync(async (store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }

        const reply = await commitOriginAiVoiceTurn(
          store,
          user,
          request,
          {
            userTranscript: parsedBody.data.userTranscript,
            assistantTranscript: parsedBody.data.assistantTranscript,
            liveSessionId: parsedBody.data.liveSessionId ?? null,
            responseId: parsedBody.data.responseId ?? null,
            model: parsedBody.data.model ?? null,
            transport: parsedBody.data.transport ?? "gemini_live",
            interrupted: parsedBody.data.interrupted ?? false,
            completionReason: parsedBody.data.completionReason ?? "unknown",
            assistantAudioChunkCount: parsedBody.data.assistantAudioChunkCount ?? 0,
            assistantTranscriptChunkCount: parsedBody.data.assistantTranscriptChunkCount ?? 0,
            hadOutputTranscript: parsedBody.data.hadOutputTranscript ?? false,
          },
          toPageContext(parsedBody.data.pageContext),
        );

        if ("error" in reply) {
          return { status: "error" as const, error: reply.error };
        }

        return { status: "created" as const, reply };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }

      if (result.status === "error") {
        return badRequest(result.error, { error: result.error });
      }

      return created(result.reply);
    }

    return notFound();
  } catch {
    return badRequest("Invalid JSON payload.");
  }
}
