import type { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/server/auth";
import { submitLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import {
  type CustomTestPayload,
  createCustomTest,
  getGeneratedDppDetail,
  getChallengeOfTheDay,
  getFocusAreas,
  getOgcodeLeaderboard,
  listOgcodeQuestions,
  listGeneratedDpps,
  getOgcodeSubjectRanks,
  getOgcodeUserStats,
  getPracticeQuestionDetail,
  getSingleResult,
  getTestDetail,
  listPracticeQuestions,
  listTestResults,
  listTests,
  type PracticeSubmissionPayload,
  submitGeneratedDpp,
  submitPracticeQuestion,
  type TestSubmissionPayload,
  submitTest,
  type UpdateOgcodeLocationPayload,
  updateOgcodeLocation,
} from "@/server/assessments";
import { badRequest, created, getSlugSegments, methodNotAllowed, notFound, ok, parseJsonBody, unauthorized } from "@/server/http";
import { readStore, withStore, withStoreAsync } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authUser(request: Request) {
  const store = readStore();
  const user = requireUserFromRequest(store, request);
  if (!user) {
    return null;
  }
  return { store, user };
}

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authUser(request);
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
      return ok(await listTests(store, user));
    }

    if (root === "tests" && first && !second) {
      return ok(await getTestDetail(store, user, first));
    }

    if (root === "tests" && first && second === "results") {
      return ok(await listTestResults(store, user, first));
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
      return ok(
        await listOgcodeQuestions(store, user, {
          subject: url.searchParams.get("subject"),
          difficulty: url.searchParams.get("difficulty"),
          type: url.searchParams.get("type"),
        }),
      );
    }

    if (root === "ogcode" && first === "challenge") {
      return ok(await getChallengeOfTheDay(store, user));
    }

    if (root === "ogcode" && first === "user-stats") {
      return ok(await getOgcodeUserStats(store, user));
    }

    if (root === "ogcode" && first === "leaderboard" && second === "subjects") {
      return ok(getOgcodeSubjectRanks(store, user));
    }

    if (root === "ogcode" && first === "stats") {
      return ok(getOgcodeSubjectRanks(store, user));
    }

    if (root === "ogcode" && first === "leaderboard") {
      const url = new URL(request.url);
      return ok(await getOgcodeLeaderboard(store, user, url.searchParams.get("subject")));
    }

    if (root === "focus-areas") {
      return ok(await getFocusAreas(store, user));
    }
  } catch (error) {
    return notFound(error instanceof Error ? error.message : "Not found.");
  }

  return notFound();
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const slug = getSlugSegments(params);
  const [root, first, second] = slug;

  const auth = authUser(request);
  if (!auth) {
    return unauthorized();
  }

  const isSubmit = second === "submit" || (root === "ogcode" && first === "location");
  const limited = await checkRateLimit(isSubmit ? submitLimiter : generalLimiter, auth.user.id);
  if (limited) return limited;

  try {
    if (root === "tests" && first === "custom") {
      const body = await parseJsonBody<CustomTestPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return createCustomTest(store, user, body);
      });
      return created(response);
    }

    if (root === "tests" && first && second === "submit") {
      const body = await parseJsonBody<TestSubmissionPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return submitTest(store, user, first, body);
      });
      return created(response);
    }

    if (root === "dpps" && first && second === "submit") {
      const body = await parseJsonBody<TestSubmissionPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return submitGeneratedDpp(store, user, first, body);
      });
      return created(response);
    }

    if (root === "practice" && first && second === "submit") {
      const body = await parseJsonBody<PracticeSubmissionPayload>(request);
      const response = await withStoreAsync(async (store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return submitPracticeQuestion(store, user, first, body);
      });
      return ok(response);
    }

    if (root === "ogcode" && first === "location") {
      const body = await parseJsonBody<UpdateOgcodeLocationPayload>(request);
      const response = withStore((store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          throw new Error("Authentication credentials were not provided.");
        }
        return updateOgcodeLocation(store, user, body);
      });
      return ok(response);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not provided")) {
      return unauthorized(error.message);
    }
    return badRequest(error instanceof Error ? error.message : "Invalid request.");
  }

  return methodNotAllowed();
}
