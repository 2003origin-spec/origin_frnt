import { NextResponse, type NextRequest } from "next/server";

import { getServerUser } from "@/lib/auth-server";
import { FeatureDisabledError, isFeatureEnabled, requireFeatureEnabled } from "@/lib/feature-flags";
import { istDateKey } from "@/lib/ist-day";
import { getMyOrbitAction, getOpenContestsAction, registerForContestAction } from "@/server/actions/contest-actions";
import {
  listOgcodeChallengeInboxAction,
  listOgcodeChallengeMutualsAction,
  reportOgcodeQuestionAction,
  revealOgcodeQuestionAction,
  sendOgcodeChallengeAction,
  toggleOgcodeQuestionLikeAction,
} from "@/server/actions/ogcode-actions";
import { completeAccountSetupAction, completeOnboardingAction, updateProfileAction, uploadUserImageAction } from "@/server/actions/profile-actions";
import { updateSocialSettingsAction } from "@/server/actions/social-actions";
import { setStudyModeAction } from "@/server/actions/study-mode-actions";
import { submitRoomTestAction } from "@/server/actions/study-room-actions";
import { addTaskAction, editTaskAction, listTasksAction, removeTaskAction, toggleTaskAction } from "@/server/actions/task-actions";
import { getContestDetail, getContestStatus } from "@/server/contest/contest-status";
import { buildPointsSummary } from "@/server/gamification";
import { parseJsonBody } from "@/server/http";
import { readStoreAsync } from "@/server/store";
import { getRoomState, getRoomTestForUser } from "@/server/study-rooms";
import { teacherHome, teacherMe, teacherMembers } from "@/server/mobile/teacher";
import { appBooks } from "@/server/mobile/books";
import { isOgcodeReportReason, OGCODE_REPORT_REASONS } from "@/server/ogcode-reports";
import { getResumeChapter } from "@/server/ogcode-progress";
import { handleMessagesApi } from "@/server/messaging/routes";
import { getChallengeOfTheDayForRender } from "@/server/render-loaders";
import { getStudentAnalytics, summarizeActivity } from "@/server/mobile/student-analytics";
import { getPopularStudents } from "@/server/social/social-service";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/server/social/username";
import { recordDailyLoginStreak } from "@/server/streak-login";

/**
 * Native-app REST endpoints for flows that were Server-Action-only
 * (V1/NATIVE_APP_API_PLAN.md §3, Phase 3). Each one calls the SAME action the
 * website uses: getServerUser() forwards the bearer credentials, so validation,
 * field allowlists and cache revalidation stay in one place.
 *
 * Authenticated: the middleware has already verified the access JWT for every
 * `/api/mobile/*` path except `/api/mobile/auth/*` and the public shell paths.
 */

type Body = Record<string, unknown>;

/**
 * Messages the actions throw that are meant for the student. Anything else
 * is treated as internal: in production Next.js never showed Server Action
 * error text to the browser, so it may describe infrastructure.
 */
const USER_FACING_ERRORS = [
  "Only image files can be uploaded.",
  "Image is too large. Please upload an image under 10 MB.",
  "Unsupported image upload purpose.",
  "Study Mode applies to student accounts only.",
  "Please sign in to register.",
  `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters using lowercase letters, numbers, or underscores.`,
  "That username is already taken.",
  "Nothing to update.",
];

/** sendOgcodeChallengeAction's error codes → HTTP (the web shows them as toasts). */
const CHALLENGE_ERRORS: Record<string, { status: number; detail: string }> = {
  self: { status: 400, detail: "You can't challenge yourself." },
  not_mutual: { status: 403, detail: "You can only challenge friends who follow you back." },
  recipient_out_of_mode: { status: 409, detail: "They aren't studying this subject right now." },
  already_pending: { status: 409, detail: "They already have a pending challenge for this question." },
};

/**
 * True for messages written for people: short prose, not a JSON or
 * validation dump from another service (a grader 422 once reached a student
 * as `{"detail":[{"type":"dict_type",...}]}`).
 */
export function isStudentReadable(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 300) return false;
  if (/^[[{]/.test(text) || /"(detail|loc|type|msg)"\s*:/.test(text)) return false;
  return !/(Traceback|Exception|Error:|stack|undefined|null\b)/.test(text);
}

export function errorResponse(scope: string, error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message === "Not authenticated.") {
    return NextResponse.json({ detail: "Authentication credentials were not provided." }, { status: 401 });
  }
  if (USER_FACING_ERRORS.includes(message)) {
    return NextResponse.json({ detail: message }, { status: 400 });
  }
  if (error instanceof FeatureDisabledError) {
    return NextResponse.json({ detail: "This feature is not available right now." }, { status: 404 });
  }
  // Domain errors that carry their own 4xx (contest registration: not found,
  // not eligible, window closed) are written for students; pass them through.
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500 && message) {
    if (isStudentReadable(message)) return NextResponse.json({ detail: message }, { status });
    console.error(`[mobile-api] ${scope} failed with an unreadable ${status}:`, message.slice(0, 2000));
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status });
  }
  console.error(`[mobile-api] ${scope} failed:`, message || error);
  return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 500 });
}

async function jsonBody(request: NextRequest): Promise<Body | NextResponse> {
  try {
    return await parseJsonBody<Body>(request);
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }
}

/**
 * Everything the dashboard renders, in one call. Mirrors
 * src/app/dashboard/page.tsx, including the daily login streak touch (first
 * load of the IST day advances the streak; later loads are no-ops).
 */
async function home(): Promise<Response> {
  const user = await getServerUser();
  if (!user) return errorResponse("home", new Error("Not authenticated."));
  const streakEnabled = isFeatureEnabled("loginStreakCelebration");
  // Tasks, points and activity are read fresh, unlike the web's cached render
  // loaders: the app refetches home right after a change (task ticked, deck
  // finished), and a cached loader serves the old value on exactly that read.
  const [tasks, store, challenge, contest, streak, resume] = await Promise.allSettled([
    listTasksAction(),
    readStoreAsync(),
    getChallengeOfTheDayForRender(istDateKey(), user.id),
    getContestStatus(user.id),
    streakEnabled ? recordDailyLoginStreak(user.id) : Promise.resolve(null),
    getResumeChapter(user.id),
  ]);
  const value = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);
  const data = value(store);
  const challengeId = (value(challenge) as { id?: unknown } | null)?.id;
  const safe = <T,>(fn: () => T): T | null => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  return NextResponse.json({
    tasks: value(tasks) ?? [],
    points: data ? safe(() => buildPointsSummary(data, user.id)) : null,
    challenge: value(challenge),
    contest: value(contest),
    streak: value(streak),
    resume: value(resume),
    // The app's daily missions and week chart (the web dashboard has neither).
    activity: data
      ? safe(() =>
          summarizeActivity(
            data.practiceAttempts.filter((a) => a.userId === user.id),
            typeof challengeId === "string" ? challengeId : null,
          ),
        )
      : null,
  });
}

async function contests(): Promise<Response> {
  const user = await getServerUser();
  if (!user) return errorResponse("contests", new Error("Not authenticated."));
  const [status, open, orbit] = await Promise.all([getContestStatus(user.id), getOpenContestsAction(), getMyOrbitAction()]);
  return NextResponse.json({ status, open, orbit });
}

async function contestDetail(id: string): Promise<Response> {
  const user = await getServerUser();
  if (!user) return errorResponse("contest", new Error("Not authenticated."));
  const contest = await getContestDetail(id, user.id);
  if (!contest) return NextResponse.json({ detail: "Contest not found." }, { status: 404 });
  return NextResponse.json({ contest });
}

/**
 * The study room's test paper for a participant (no answer keys). The web
 * reads it in a server component; same guards: only while the room test is
 * running and the student hasn't submitted. Reads the store without writing
 * it back (the web page's withStoreAsync write is bug N3 in BUG_FIX_PLAN.md).
 */
async function roomTest(id: string): Promise<Response> {
  const user = await getServerUser();
  if (!user) return errorResponse("room-test", new Error("Not authenticated."));
  const state = await getRoomState(id, user.id);
  if (state.room.status === "lobby") return NextResponse.json({ detail: "The host hasn't started the test yet.", code: "not_started" }, { status: 409 });
  if (state.room.status === "finished") return NextResponse.json({ detail: "This room's test is over.", code: "finished" }, { status: 409 });
  if (state.room.status === "closed") return NextResponse.json({ detail: "This room is closed.", code: "closed" }, { status: 404 });
  const me = state.participants.find((p) => p.user_id === user.id);
  if (me?.finished_at) return NextResponse.json({ detail: "You've already submitted this test.", code: "submitted" }, { status: 409 });
  const { room, test } = await getRoomTestForUser(await readStoreAsync(), user, id);
  return NextResponse.json({ room, test });
}

/**
 * The three "popular students" lists behind the web's /social page (most
 * followed, top ranked, most active), which reads them in a server component.
 * Students only, like every /api/social route.
 */
async function popularStudents(): Promise<Response> {
  requireFeatureEnabled("studentSocial");
  const user = await getServerUser();
  if (!user) return errorResponse("social-popular", new Error("Not authenticated."));
  if (user.role !== "student") return NextResponse.json({ detail: "Only students can use this." }, { status: 403 });
  return NextResponse.json(await getPopularStudents(user.id));
}

async function sendChallenge(questionId: string, body: Body): Promise<Response> {
  const toUserId = typeof body.toUserId === "string" ? body.toUserId.trim() : "";
  if (!toUserId) return NextResponse.json({ detail: "toUserId is required." }, { status: 400 });
  const result = await sendOgcodeChallengeAction(questionId, toUserId);
  if (result.ok) return NextResponse.json({ ok: true });
  const known = CHALLENGE_ERRORS[result.error ?? ""];
  return NextResponse.json(
    { detail: known?.detail ?? "Could not send the challenge.", code: result.error ?? "failed" },
    { status: known?.status ?? 400 },
  );
}

async function avatar(request: NextRequest): Promise<Response> {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Send the image as multipart/form-data with a `file` field." }, { status: 400 });
  }
  // The app may only set its own profile photo; other purposes are teacher tools.
  const form = new FormData();
  const file = incoming.get("file");
  if (file) form.set("file", file);
  form.set("purpose", "profile_avatar");
  const upload = await uploadUserImageAction(form);
  const user = await updateProfileAction({ avatar: upload.url });
  return NextResponse.json({ avatar: upload.url, user });
}

const MAX_TASK_LENGTH = 200;

/**
 * The student's tasks (the web's Tasks & Goals), for the app's focus screen and
 * daily missions. Same Server Actions as the web, so both stay in step. A new
 * task is due at the end of today (IST) unless `due` is given.
 */
async function tasks(method: string, id: string | undefined, request: NextRequest): Promise<Response | null> {
  try {
    if (method === "GET" && !id) return NextResponse.json({ tasks: await listTasksAction() });
    if (method === "DELETE" && id) {
      await removeTaskAction(id);
      return NextResponse.json({ ok: true });
    }
    if ((method === "POST" && !id) || (method === "PATCH" && id)) {
      const body = await jsonBody(request);
      if (body instanceof NextResponse) return body;
      if (method === "POST") {
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) return NextResponse.json({ detail: "Write the task first." }, { status: 400 });
        if (text.length > MAX_TASK_LENGTH) {
          return NextResponse.json({ detail: `Keep a task under ${MAX_TASK_LENGTH} characters.` }, { status: 400 });
        }
        const due =
          typeof body.due === "string" && Number.isFinite(Date.parse(body.due))
            ? new Date(body.due).toISOString()
            : new Date(Date.parse(`${istDateKey()}T23:59:59+05:30`)).toISOString();
        const task = await addTaskAction({
          text,
          due,
          ...(typeof body.category === "string" ? { category: body.category.slice(0, 40) } : {}),
        });
        return NextResponse.json({ task }, { status: 201 });
      }
      if (typeof body.completed === "boolean") return NextResponse.json({ task: await toggleTaskAction(id!, body.completed) });
      if (typeof body.text === "string") {
        if (body.text.trim().length > MAX_TASK_LENGTH) {
          return NextResponse.json({ detail: `Keep a task under ${MAX_TASK_LENGTH} characters.` }, { status: 400 });
        }
        return NextResponse.json({ task: await editTaskAction(id!, body.text) });
      }
      return NextResponse.json({ detail: "Nothing to update." }, { status: 400 });
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Task not found.") return NextResponse.json({ detail: message }, { status: 404 });
    if (message === "text is required.") return NextResponse.json({ detail: "Write the task first." }, { status: 400 });
    throw error;
  }
}

/** Dispatch an authenticated `/api/mobile/<slug>` request. Returns null if no route matches. */
export async function handleAppApi(method: string, request: NextRequest, slug: string[]): Promise<Response | null> {
  const [head, id, action] = slug;
  try {
    // Student messaging has its own flag gate, auth and error codes (src/server/messaging/routes.ts).
    if (head === "messages") return await handleMessagesApi(method, request, slug);
    if (method === "GET" && slug.length === 1 && head === "home") return await home();
    if (head === "tasks" && slug.length <= 2) {
      const handled = await tasks(method, id, request);
      if (handled) return handled;
    }
    if (method === "GET" && slug.length === 1 && head === "books") return NextResponse.json({ books: appBooks() });
    if (method === "GET" && slug.length === 2 && head === "teacher" && id === "me") return await teacherMe(request);
    if (method === "GET" && slug.length === 4 && head === "teacher" && id === "workspaces" && slug[3] === "home") return await teacherHome(request, action);
    if (method === "GET" && slug.length === 4 && head === "teacher" && id === "workspaces" && slug[3] === "members") return await teacherMembers(request, action);
    if (method === "GET" && slug.length === 1 && head === "contests") return await contests();
    if (method === "GET" && slug.length === 2 && head === "contests") return await contestDetail(id);
    if (method === "GET" && slug.length === 3 && head === "study-rooms" && action === "test") return await roomTest(id);
    if (method === "GET" && slug.length === 2 && head === "social" && id === "popular") return await popularStudents();
    if (method === "GET" && slug.length === 1 && head === "analytics") {
      const user = await getServerUser();
      if (!user) return errorResponse("analytics", new Error("Not authenticated."));
      return NextResponse.json(await getStudentAnalytics(user.id));
    }
    if (method === "GET" && slug.length === 2 && head === "ogcode" && id === "challenges") {
      return NextResponse.json(await listOgcodeChallengeInboxAction());
    }
    if (method === "GET" && slug.length === 2 && head === "ogcode" && id === "challenge-friends") {
      const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 60);
      return NextResponse.json({ results: await listOgcodeChallengeMutualsAction(q) });
    }

    if (method === "POST" && slug.length === 1 && head === "avatar") return await avatar(request);

    if (method === "POST" || method === "PATCH") {
      const body = await jsonBody(request);
      if (body instanceof NextResponse) return body;

      if (method === "POST" && slug.length === 1 && head === "onboarding") {
        return NextResponse.json({ user: await completeOnboardingAction(body) });
      }
      // The website's onboarding step 5: a mobile for accounts without one, and a
      // password for Google sign-ups (passwordSet === false). Same action, same rules.
      // The app reports errors it hid from the student (raw server text, crashes in
      // a screen) so they reach our logs. Logged only, never stored or echoed back.
      if (method === "POST" && slug.length === 1 && head === "client-errors") {
        const user = await getServerUser();
        const clip = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : null);
        console.warn("[mobile-client-error]", {
          userId: user?.id ?? null,
          where: clip(body.where, 120),
          path: clip(body.path, 300),
          status: typeof body.status === "number" ? body.status : null,
          message: clip(body.message, 2000),
          appVersion: clip(body.appVersion, 40),
        });
        return new NextResponse(null, { status: 204 });
      }
      if (method === "POST" && slug.length === 1 && head === "account-setup") {
        const result = await completeAccountSetupAction({
          mobile: typeof body.mobile === "string" ? body.mobile : "",
          password: typeof body.password === "string" ? body.password : undefined,
        });
        return NextResponse.json(result, { status: result.ok ? 200 : 400 });
      }
      if (method === "PATCH" && slug.length === 1 && head === "profile") {
        return NextResponse.json({ user: await updateProfileAction(body) });
      }
      if (method === "POST" && slug.length === 1 && head === "study-mode") {
        const result = await setStudyModeAction(body.mode);
        return NextResponse.json(result, { status: result.ok ? 200 : 400 });
      }
      if (method === "POST" && slug.length === 3 && head === "contests" && action === "register") {
        const code = typeof body.code === "string" ? body.code : undefined;
        return NextResponse.json(await registerForContestAction(id, code));
      }
      if (method === "POST" && slug.length === 3 && head === "study-rooms" && action === "submit") {
        if (!Array.isArray(body.answers)) return NextResponse.json({ detail: "answers must be an array." }, { status: 400 });
        const result = await submitRoomTestAction(id, {
          answers: body.answers,
          timeTaken: typeof body.timeTaken === "number" ? body.timeTaken : 0,
          isMalpractice: body.isMalpractice === true,
        } as Parameters<typeof submitRoomTestAction>[1]);
        return NextResponse.json(result);
      }
      if (method === "POST" && slug.length === 3 && head === "ogcode" && action === "reveal") {
        const kind = body.kind === "answer" ? "answer" : body.kind === "hint" ? "hint" : null;
        if (!kind) return NextResponse.json({ detail: 'kind must be "hint" or "answer".' }, { status: 400 });
        return NextResponse.json(await revealOgcodeQuestionAction(id, kind));
      }
      if (method === "PATCH" && slug.length === 2 && head === "social" && id === "settings") {
        const input = {
          ...(typeof body.username === "string" ? { username: body.username } : {}),
          ...(typeof body.profilePrivate === "boolean" ? { profilePrivate: body.profilePrivate } : {}),
        };
        const user = await updateSocialSettingsAction(input);
        return NextResponse.json({ username: user.username ?? null, profilePrivate: Boolean(user.profilePrivate) });
      }
      if (method === "POST" && slug.length === 3 && head === "ogcode" && action === "report") {
        // The web's "Report question" (a Server Action there): reason from the fixed list, optional note.
        const reason = typeof body.reason === "string" ? body.reason : "";
        if (!isOgcodeReportReason(reason)) {
          return NextResponse.json({ detail: `reason must be one of: ${OGCODE_REPORT_REASONS.join(", ")}.` }, { status: 400 });
        }
        const description = typeof body.description === "string" ? body.description.slice(0, 2000) : null;
        const result = await reportOgcodeQuestionAction(id, reason, description);
        if (!result.ok) return NextResponse.json({ detail: "Couldn’t send the report. Please try again." }, { status: 503 });
        return NextResponse.json({ ok: true });
      }
      if (method === "POST" && slug.length === 3 && head === "ogcode" && action === "challenge") return await sendChallenge(id, body);
      if (method === "POST" && slug.length === 3 && head === "ogcode" && action === "like") {
        return NextResponse.json(await toggleOgcodeQuestionLikeAction(id));
      }
    }
    return null;
  } catch (error) {
    return errorResponse(slug.join("/"), error);
  }
}
