import type { NextRequest } from "next/server";

import {
  isOriginAiChapterSubject,
  refreshChapterCatalog,
  ORIGIN_AI_CHAPTER_SUBJECTS,
  type OriginAiChapterSubject,
} from "@/server/catalog-cache";
import { badRequest, ok, unauthorized } from "@/server/http";

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.INTERNAL_CRON_TOKEN;
  if (!token) {
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return unauthorized("Invalid internal refresh token.");
  }

  const requestedSubjects = request.nextUrl.searchParams.getAll("subject");
  const subjects: readonly OriginAiChapterSubject[] = requestedSubjects.length
    ? requestedSubjects.filter(isOriginAiChapterSubject)
    : ORIGIN_AI_CHAPTER_SUBJECTS;

  if (requestedSubjects.length && subjects.length !== requestedSubjects.length) {
    return badRequest("Invalid subject. Must be one of: math, phy, chem, bio");
  }

  return ok(await refreshChapterCatalog(subjects));
}

export async function GET(request: NextRequest) {
  return POST(request);
}
