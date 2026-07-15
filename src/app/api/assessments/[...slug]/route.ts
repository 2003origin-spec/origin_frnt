import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

import { listOgcodeCatalogFacets } from "@/server/ogcode-catalog";
import { requireUserFromRequest } from "@/server/auth";
import { submitLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import {
  type CustomTestPayload,
  checkGeneratedDppQuestion,
  createCustomTest,
  getGeneratedDppDetail,
  getChallengeOfTheDay,
  getFocusAreas,
  getOgcodeLeaderboard,
  listOgcodeQuestionChapters,
  listOgcodeQuestionPage,
  listOgcodeQuestions,
  listGeneratedDpps,
  getOgcodeSubjectRanks,
  getOgcodeUserStats,
  getPracticeQuestionDetail,
  getSingleResultAnalysis,
  getSingleResult,
  getTestDetail,
  listTestPreviews,
  listPracticeQuestions,
  listTestResults,
  type PracticeSubmissionPayload,
  type DppQuestionCheckPayload,
  submitGeneratedDpp,
  submitPracticeQuestion,
  type TestSubmissionPayload,
  submitTest,
  type UpdateOgcodeLocationPayload,
  updateOgcodeLocation,
} from "@/server/assessments";
import { badRequest, created, forbidden, getSlugSegments, methodNotAllowed, notFound, ok, parseJsonBody, unauthorized } from "@/server/http";
import {
  readStoreAsync,
  withStoreAsync,
  withStoreAsyncScoped,
  TEST_SUBMIT_PERSIST_COLLECTIONS,
  PRACTICE_SUBMIT_PERSIST_COLLECTIONS,
} from "@/server/store";
import { getOgcodeLeaderboardForRender } from "@/server/render-loaders";

function revalidateUserProgress(userId: string) {
  revalidateTag("milestones", "max");
  revalidateTag("progress", "max");
  revalidateTag(`progress-user:${userId}`, "max");
  revalidateTag("leaderboard", "max");
  revalidateTag("auth-user", "max");
  revalidateTag(`user:${userId}`, "max");
}

function revalidateTestMutation(userId: string, testId?: string) {
  revalidateTag("tests", "max");
  if (testId) {
    revalidateTag(`test:${testId}`, "max");
  }
  revalidateUserProgress(userId);
  revalidateTag("ogcode-catalog", "max");
}

function revalidateOgcodeMutation(userId: string, questionId?: string) {
  revalidateUserProgress(userId);
  revalidateTag("ogcode-catalog", "max");
  revalidateTag(`ogcode-user:${userId}`, "max");
  revalidateTag("user-stats", "max");
  if (questionId) {
    revalidateTag(`ogcode-question:${questionId}`, "max");
  }
}

async function authUser(request: Request) {
  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) {
    return null;
  }
  return { store, user };
}

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authUser(request);
  if (!auth) {
    return unauthorized();
  }

  const limited = await checkRateLimit(generalLimiter, auth.user.id);
  if (limited) return limited;

  const { store, user } = auth;
  const params = await context.params;
  const slug = getSlugSegments(params);
  const [root, first, second] = slug;

  try {
    if (root === "tests" && !first) {
      return ok(await listTestPreviews(store, user));
    }

    if (root === "tests" && first && !second) {
      return ok(await getTestDetail(store, user, first));
    }

    if (root === "tests" && first && second === "results") {
      return ok(await listTestResults(store, user, first));
    }

    if (root === "results" && first && second === "analysis") {
      return ok(await getSingleResultAnalysis(store, user, first));
    }

    if (root === "results" && first) {
      return ok(await getSingleResult(store, user, first));
    }

    if (root === "dpps" && !first) {
      return ok(await listGeneratedDpps(store, user));
    }

    if (root === "dpps" && first && !second) {
      return ok(await getGeneratedDppDetail(store, user, first));
    }

    if (root === "practice" && !first) {
      const url = new URL(request.url);
      return ok(
        listPracticeQuestions(store, user, {
          subject: url.searchParams.get("subject"),
          difficulty: url.searchParams.get("difficulty"),
          type: url.searchParams.get("type"),
        }),
      );
    }

    if (root === "practice" && first && !second) {
      return ok(await getPracticeQuestionDetail(store, user, first));
    }

    if (root === "ogcode" && first === "questions") {
      const url = new URL(request.url);
      const limit = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      // Read repeated ?chapters=… params. Chapter names contain commas,
      // so we can't use a CSV separator here.
      const chapters = url.searchParams
        .getAll("chapters")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const classes = url.searchParams.getAll("classes").map(Number).filter(n => !isNaN(n) && n > 0);
      const occurrences = url.searchParams.getAll("occurrences").filter(Boolean);
      const subjects = url.searchParams.getAll("subjects").filter(Boolean);
      const concepts = url.searchParams.getAll("concepts").filter(Boolean);
      const pyqOnly = url.searchParams.get("pyq_only") === "true";
      const likedOnly = url.searchParams.get("liked_only") === "true";
      const contributedOnly = url.searchParams.get("contributed_only") === "true";

      if (limit) {
        return ok(
          await listOgcodeQuestionPage(store, user, {
            subject: url.searchParams.get("subject"),
            difficulty: url.searchParams.get("difficulty"),
            type: url.searchParams.get("type"),
            search: url.searchParams.get("search"),
            status: url.searchParams.get("status") as "solved" | "unsolved" | null,
            chapters,
            limit: Number(limit),
            offset: offset ? Number(offset) : 0,
            classes: classes.length ? classes : null,
            occurrences: occurrences.length ? occurrences : null,
            subjects: subjects.length ? subjects : null,
            concepts: concepts.length ? concepts : null,
            pyqOnly,
            likedOnly,
            contributedOnly,
          }),
        );
      }

      return ok(
        await listOgcodeQuestions(store, user, {
          subject: url.searchParams.get("subject"),
          difficulty: url.searchParams.get("difficulty"),
          type: url.searchParams.get("type"),
        }),
      );
    }

    if (root === "ogcode" && first === "seed-temp") {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const { getOgcodePostgresPool } = await import("@/server/postgres");

      const jsonPath = path.resolve(process.cwd(), "data/ogcode/ogcode_questions.json");
      if (!fs.existsSync(jsonPath)) {
        return badRequest("ogcode_questions.json file not found");
      }
      
      const raw = fs.readFileSync(jsonPath, "utf8");
      const questions = JSON.parse(raw);

      const pool = getOgcodePostgresPool();
      if (!pool) {
        return badRequest("Postgres pool not available");
      }

      const CREATE_TABLE_SQL = `
        CREATE TABLE IF NOT EXISTS ogcode_questions (
          id TEXT PRIMARY KEY,
          source_index INTEGER NOT NULL UNIQUE,
          text TEXT NOT NULL,
          options JSONB,
          correct_option INTEGER,
          correct_options JSONB,
          answer_text TEXT,
          answer_spec JSONB,
          tolerance DOUBLE PRECISION,
          matrix_data JSONB,
          explanation TEXT NOT NULL,
          hint TEXT,
          subject TEXT NOT NULL,
          chapter TEXT NOT NULL,
          concept TEXT NOT NULL,
          difficulty TEXT NOT NULL,
          image TEXT,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          question_type TEXT NOT NULL,
          acceptance_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
          total_correct INTEGER NOT NULL DEFAULT 0,
          frequency INTEGER NOT NULL DEFAULT 0,
          is_challenge_of_day BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          contributor_workspace_id TEXT,
          attribution_name TEXT,
          attribution_logo_url TEXT,
          is_contributed BOOLEAN NOT NULL DEFAULT FALSE,
          occurrence TEXT,
          class INTEGER,
          previous_year_question TEXT
        );
        CREATE INDEX IF NOT EXISTS ogcode_questions_subject_idx ON ogcode_questions (subject);
        CREATE INDEX IF NOT EXISTS ogcode_questions_difficulty_idx ON ogcode_questions (difficulty);
        CREATE INDEX IF NOT EXISTS ogcode_questions_question_type_idx ON ogcode_questions (question_type);
        CREATE INDEX IF NOT EXISTS ogcode_questions_contributed_idx ON ogcode_questions (is_contributed);
      `;
      await pool.query(CREATE_TABLE_SQL);
      await pool.query("DELETE FROM ogcode_questions");

      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);
        const valuesPlaceholder: string[] = [];
        const valuesArray: any[] = [];
        let pIndex = 1;

        for (const q of batch) {
          const rowPlaceholders: string[] = [];
          const cols = [
            q.id,
            q.source_index,
            q.text,
            q.options ? JSON.stringify(q.options) : null,
            q.correct_option,
            q.correct_options ? JSON.stringify(q.correct_options) : null,
            q.answer_text,
            q.answer_spec ? JSON.stringify(q.answer_spec) : null,
            q.tolerance,
            q.matrix_data ? JSON.stringify(q.matrix_data) : null,
            q.explanation,
            q.hint,
            q.subject,
            q.chapter,
            q.concept,
            q.difficulty,
            q.image,
            q.tags ? JSON.stringify(q.tags) : '[]',
            q.question_type,
            q.acceptance_rate ?? 0,
            q.total_correct ?? 0,
            q.frequency ?? 0,
            q.is_challenge_of_day ?? false,
            q.contributor_workspace_id,
            q.attribution_name,
            q.attribution_logo_url,
            q.is_contributed ?? false,
            q.occurrence,
            q.class,
            q.previous_year_question
          ];

          for (const val of cols) {
            rowPlaceholders.push(`$${pIndex++}`);
            valuesArray.push(val);
          }
          valuesPlaceholder.push(`(${rowPlaceholders.join(",")})`);
        }

        const query = `
          INSERT INTO ogcode_questions (
            id, source_index, text, options, correct_option, correct_options, answer_text,
            answer_spec, tolerance, matrix_data, explanation, hint, subject, chapter, concept,
            difficulty, image, tags, question_type, acceptance_rate, total_correct, frequency,
            is_challenge_of_day, contributor_workspace_id, attribution_name, attribution_logo_url,
            is_contributed, occurrence, class, previous_year_question
          ) VALUES ${valuesPlaceholder.join(",")}
          ON CONFLICT (id) DO NOTHING
        `;

        await pool.query(query, valuesArray);
        insertedCount += batch.length;
      }

      revalidateTag("ogcode-catalog", "max");
      return ok({ success: true, count: insertedCount });
    }

    if (root === "ogcode" && first === "facets") {
      const url = new URL(request.url);
      const level = url.searchParams.get("level");
      const validLevels = ['class', 'occurrence', 'subject', 'chapter', 'concept'];
      if (!level || !validLevels.includes(level)) {
        return badRequest("Missing or invalid level parameter");
      }
      const facetClasses = url.searchParams.getAll("classes").map(Number).filter(n => !isNaN(n) && n > 0);
      const facetOccurrences = url.searchParams.getAll("occurrences").filter(Boolean);
      const facetSubjects = url.searchParams.getAll("subjects").filter(Boolean);
      const facetChapters = url.searchParams.getAll("chapters").filter(Boolean);
      return ok(await listOgcodeCatalogFacets({
        level: level as 'class' | 'occurrence' | 'subject' | 'chapter' | 'concept',
        classes: facetClasses,
        occurrences: facetOccurrences,
        subjects: facetSubjects,
        chapters: facetChapters,
      }));
    }

    if (root === "ogcode" && first === "challenge") {
      return ok(await getChallengeOfTheDay(store, user));
    }

    if (root === "ogcode" && first === "chapters") {
      const url = new URL(request.url);
      const subject = url.searchParams.get("subject");
      return ok(subject ? await listOgcodeQuestionChapters(store, user, subject) : []);
    }

    if (root === "ogcode" && first === "user-stats") {
      return ok(await getOgcodeUserStats(store, user));
    }

    if (root === "ogcode" && first === "leaderboard" && second === "subjects") {
      return ok(await getOgcodeSubjectRanks(store, user));
    }

    if (root === "ogcode" && first === "stats") {
      return ok(await getOgcodeSubjectRanks(store, user));
    }

    if (root === "ogcode" && first === "leaderboard") {
      const url = new URL(request.url);
      const subject = url.searchParams.get("subject");
      const location = url.searchParams.get("location");
      // Top-N: 20/50/100/1000 or "all". "all" maps to a large cap.
      const limitRaw = url.searchParams.get("limit");
      const limit = limitRaw === "all" ? 100_000 : Math.max(1, Math.min(100_000, Number(limitRaw) || 100));
      // The common (no-location) view goes through the cached loader
      // (60s revalidate, tag:"leaderboard") so it isn't recomputed on every
      // client mount. The regional view stays live — it's not part of the cache.
      if (!location) {
        return ok(await getOgcodeLeaderboardForRender(user.id, subject, limit));
      }
      return ok(await getOgcodeLeaderboard(store, user, subject, location, limit));
    }

    if (root === "focus-areas") {
      return ok(await getFocusAreas(store, user));
    }
  } catch (error) {
    if ((error as { status?: number })?.status === 403) {
      return forbidden(error instanceof Error ? error.message : "Forbidden.");
    }
    return notFound(error instanceof Error ? error.message : "Not found.");
  }

  return notFound();
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const slug = getSlugSegments(params);
  const [root, first, second] = slug;

  const auth = await authUser(request);
  if (!auth) {
    return unauthorized();
  }

  const isSubmit = second === "submit" || (root === "ogcode" && first === "location");
  const limited = await checkRateLimit(isSubmit ? submitLimiter : generalLimiter, auth.user.id);
  if (limited) return limited;

  try {
    if (root === "tests" && first === "custom") {
      const body = await parseJsonBody<CustomTestPayload>(request);
      // createCustomTest writes its durable record via persistGeneratedCustomTest
      // and mutates no store collection, so skip the wholesale store persist.
      const response = await withStoreAsyncScoped(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return createCustomTest(store, user, body);
      }, null);
      revalidateTag("tests", "max");
      revalidateTag(`progress-user:${auth.user.id}`, "max");
      return created(response);
    }

    if (root === "tests" && first && second === "submit") {
      const body = await parseJsonBody<TestSubmissionPayload>(request);
      const response = await withStoreAsyncScoped(
        async (store) => {
          const user = await requireUserFromRequest(store, request);
          if (!user) {
            throw new Error("Authentication credentials were not provided.");
          }
          return submitTest(store, user, first, body);
        },
        { userId: auth.user.id, collections: TEST_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
      );
      revalidateTestMutation(auth.user.id, first);
      return created(response);
    }

    if (root === "dpps" && first && second === "submit") {
      const body = await parseJsonBody<TestSubmissionPayload>(request);
      // DPP submit persists its attempt via persistDppAttemptResult; only the
      // shared gamification collections need a scoped store write.
      const response = await withStoreAsyncScoped(
        async (store) => {
          const user = await requireUserFromRequest(store, request);
          if (!user) {
            throw new Error("Authentication credentials were not provided.");
          }
          return submitGeneratedDpp(store, user, first, body);
        },
        { userId: auth.user.id, collections: TEST_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
      );
      revalidateTestMutation(auth.user.id);
      return created(response);
    }

    if (root === "dpps" && first && second === "check") {
      const body = await parseJsonBody<DppQuestionCheckPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return checkGeneratedDppQuestion(store, user, first, body);
      });
      return ok(response);
    }

    if (root === "practice" && first && second === "submit") {
      const body = await parseJsonBody<PracticeSubmissionPayload>(request);
      // Practice submit's attempt + subject-rank live only in the store (no
      // targeted writer), so they are included in the scoped persist set.
      const response = await withStoreAsyncScoped(
        async (store) => {
          const user = await requireUserFromRequest(store, request);
          if (!user) {
            throw new Error("Authentication credentials were not provided.");
          }
          return submitPracticeQuestion(store, user, first, body);
        },
        { userId: auth.user.id, collections: PRACTICE_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
      );
      revalidateOgcodeMutation(auth.user.id, first);
      return ok(response);
    }

    if (root === "ogcode" && first === "location") {
      const body = await parseJsonBody<UpdateOgcodeLocationPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return updateOgcodeLocation(store, user, body);
      });
      revalidateTag("leaderboard", "max");
      revalidateTag(`progress-user:${auth.user.id}`, "max");
      return ok(response);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not provided")) {
      return unauthorized(error.message);
    }
    if ((error as { status?: number })?.status === 403) {
      return forbidden(error instanceof Error ? error.message : "Forbidden.");
    }
    return badRequest(error instanceof Error ? error.message : "Invalid request.");
  }

  return methodNotAllowed();
}
