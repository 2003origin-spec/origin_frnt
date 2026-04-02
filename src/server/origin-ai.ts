import fs from "node:fs";
import path from "node:path";

import {
  getPracticeQuestionDetail,
  getTestDetail,
} from "@/server/assessments";
import { awardPoints } from "@/server/gamification";
import {
  createId,
  type AppStore,
  type StoredChatMessage,
  type StoredOriginAiProfileMemory,
  type StoredOriginAiReminder,
  type StoredOriginAiSession,
  type StoredTestResult,
  type StoredUser,
} from "@/server/store";
import {
  generateOriginAiProviderReply,
  type OriginAiProviderRequest,
} from "@/server/origin-ai-provider";

export type OriginAiPageKind =
  | "dashboard"
  | "dpp"
  | "test_active"
  | "test_result"
  | "tests_index"
  | "ogcode_question"
  | "ogcode_index"
  | "study_corner"
  | "pomodoro"
  | "profile"
  | "tasks"
  | "doubt_solver"
  | "unknown";

export type OriginAiPolicyMode = "normal" | "hint_only" | "answer_blocked";

export interface OriginAiPageContextInput {
  pathname?: string | null;
  pageKind?: OriginAiPageKind | null;
  testId?: string | null;
  questionId?: string | null;
}

interface OriginAiResolvedPageContext {
  pathname: string;
  pageKind: OriginAiPageKind;
  testId: string | null;
  questionId: string | null;
  title: string | null;
  subject: string | null;
  chapter: string | null;
  concept: string | null;
  hint: string | null;
}

interface OriginAiPolicy {
  mode: OriginAiPolicyMode;
  title: string;
  reason: string;
}

interface OriginAiMemoryPayload {
  preferredName: string;
  identitySummary: string;
  pinnedFacts: string[];
  lastWeakTopics: string[];
  pendingDppCount: number;
  pendingAssignmentCount: number;
  currentStreak: number;
  lastTestSummary: string | null;
}

export interface OriginAiSessionPayload {
  id: string;
  title: string;
  summary: string | null;
  lastPathname: string | null;
  lastPageKind: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

export interface OriginAiSnapshotPayload {
  session: OriginAiSessionPayload;
  memory: OriginAiMemoryPayload;
  reminders: StoredOriginAiReminder[];
  pageContext: OriginAiResolvedPageContext;
  pagePolicy: OriginAiPolicy;
  provider: string;
}

export interface OriginAiReplyPayload extends OriginAiSnapshotPayload {
  userMessage: StoredChatMessage;
  aiMessage: StoredChatMessage;
}

const PROMPT_CACHE = new Map<string, string>();

function nowIso(): string {
  return new Date().toISOString();
}

function firstName(user: StoredUser): string {
  return user.name.trim().split(/\s+/)[0] || "there";
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function loadPromptDoc(fileName: string): string {
  const cacheKey = fileName;
  const cached = PROMPT_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const filePath = path.join(process.cwd(), "src", "origin-ai", fileName);
  const text = fs.readFileSync(filePath, "utf8");
  PROMPT_CACHE.set(cacheKey, text);
  return text;
}

function derivePathname(request: Request, input?: OriginAiPageContextInput | null): string {
  if (input?.pathname?.trim()) {
    return input.pathname.trim();
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return "/dashboard";
  }

  try {
    const url = new URL(referer);
    return url.pathname || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function inferPageKind(pathname: string, input?: OriginAiPageContextInput | null): OriginAiPageKind {
  if (input?.pageKind) {
    return input.pageKind;
  }

  if (/^\/tests\/[^/]+\/result$/.test(pathname)) {
    return "test_result";
  }
  if (/^\/tests\/[^/]+$/.test(pathname)) {
    return "test_active";
  }
  if (pathname === "/tests") {
    return "tests_index";
  }
  if (/^\/ogcode\/[^/]+$/.test(pathname)) {
    return "ogcode_question";
  }
  if (pathname === "/ogcode") {
    return "ogcode_index";
  }
  if (pathname === "/dashboard") {
    return "dashboard";
  }
  if (pathname === "/dpp") {
    return "dpp";
  }
  if (pathname === "/study-corner") {
    return "study_corner";
  }
  if (pathname === "/pomodoro") {
    return "pomodoro";
  }
  if (pathname === "/profile") {
    return "profile";
  }
  if (pathname === "/tasks") {
    return "tasks";
  }
  if (pathname === "/doubt-solver") {
    return "doubt_solver";
  }
  return "unknown";
}

function extractPathEntityId(pathname: string, prefix: string): string | null {
  const match = pathname.match(new RegExp(`^\\/${prefix}\\/([^/]+)`));
  return match?.[1] ?? null;
}

async function resolvePageContext(
  store: AppStore,
  user: StoredUser,
  request: Request,
  input?: OriginAiPageContextInput | null,
): Promise<OriginAiResolvedPageContext> {
  const pathname = derivePathname(request, input);
  const pageKind = inferPageKind(pathname, input);
  const testId = input?.testId ?? extractPathEntityId(pathname, "tests");
  const questionId = input?.questionId ?? extractPathEntityId(pathname, "ogcode");

  const context: OriginAiResolvedPageContext = {
    pathname,
    pageKind,
    testId,
    questionId,
    title: null,
    subject: null,
    chapter: null,
    concept: null,
    hint: null,
  };

  try {
    if (pageKind === "ogcode_question" && questionId) {
      const question = await getPracticeQuestionDetail(store, user, questionId);
      context.title = question.text;
      context.subject = question.subject ?? null;
      context.chapter = question.chapter ?? null;
      context.concept = question.concept ?? null;
      context.hint = question.hint ?? null;
      return context;
    }

    if ((pageKind === "test_active" || pageKind === "test_result") && testId) {
      const test = getTestDetail(store, user, testId);
      context.title = test.title;
      context.subject = test.subject ?? null;
      context.chapter = test.chapter ?? null;
      return context;
    }
  } catch {
    return context;
  }

  return context;
}

function resolvePagePolicy(pageContext: OriginAiResolvedPageContext): OriginAiPolicy {
  if (pageContext.pageKind === "test_active") {
    return {
      mode: "answer_blocked",
      title: "Integrity Mode",
      reason:
        "You are on a live test page, so Origin AI will not provide direct answers. It can help with time strategy, calming nerves, and what to review after submission.",
    };
  }

  if (pageContext.pageKind === "ogcode_question") {
    return {
      mode: "hint_only",
      title: "Hint Mode",
      reason:
        "You are attempting an OGCode question, so Origin AI will only provide hints, direction, and concept nudges, not the final answer.",
    };
  }

  return {
    mode: "normal",
    title: "Mentor Mode",
    reason: "Origin AI can coach, explain, plan revision, and help with study strategy here.",
  };
}

function getLatestResult(store: AppStore, userId: string): StoredTestResult | null {
  const results = store.testResults
    .filter((result) => result.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return results[0] ?? null;
}

function getOrCreateProfileMemory(store: AppStore, user: StoredUser): StoredOriginAiProfileMemory {
  let memory = store.originAiProfiles.find((entry) => entry.userId === user.id);
  if (!memory) {
    memory = {
      userId: user.id,
      preferredName: firstName(user),
      identitySummary: null,
      pinnedFacts: [],
      lastWeakTopics: [],
      lastTestResultId: null,
      lastVisitedPath: null,
      reminderDigest: [],
      updatedAt: nowIso(),
    };
    store.originAiProfiles.push(memory);
  }
  return memory;
}

function getOrCreateMentorSession(store: AppStore, user: StoredUser): StoredOriginAiSession {
  let session = store.originAiSessions.find((entry) => entry.userId === user.id);
  if (!session) {
    const timestamp = nowIso();
    session = {
      id: createId("origin_ai"),
      userId: user.id,
      title: "Origin AI Mentor",
      summary: "Persistent mentor chat for study guidance and revision planning.",
      lastPathname: null,
      lastPageKind: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
    };
    store.originAiSessions.push(session);
  }
  return session;
}

function buildReminders(store: AppStore, user: StoredUser, latestResult: StoredTestResult | null): StoredOriginAiReminder[] {
  const createdAt = nowIso();
  const reminders: StoredOriginAiReminder[] = [];

  const pendingDpps = store.dpps.filter((entry) => entry.userId === user.id && !entry.completed);
  for (const dpp of pendingDpps.slice(0, 3)) {
    reminders.push({
      id: `reminder_dpp_${dpp.id}`,
      userId: user.id,
      kind: "dpp",
      title: `Finish ${dpp.title}`,
      message: `You still have a pending ${titleCase(dpp.subject)} DPP. Small progress still counts, even if today is a one-question day.`,
      priority: "high",
      sourceId: dpp.id,
      createdAt,
    });
  }

  if (latestResult) {
    for (const weak of latestResult.weakAreas.slice(0, 3)) {
      reminders.push({
        id: `reminder_revision_${weak.topic.replace(/\s+/g, "_").toLowerCase()}`,
        userId: user.id,
        kind: "revision",
        title: `Revise ${weak.topic}`,
        message: `${weak.topic} was one of your weaker zones in the last test. A short revision sprint here will pay rent.`,
        priority: "high",
        sourceId: latestResult.id,
        createdAt,
      });
    }
  }

  const pendingAssignments = store.assignments.filter((entry) => entry.userId === user.id && !entry.completed);
  for (const assignment of pendingAssignments.slice(0, 2)) {
    reminders.push({
      id: `reminder_assignment_${assignment.id}`,
      userId: user.id,
      kind: "assignment",
      title: `Assignment pending: ${assignment.title}`,
      message: `Your ${titleCase(assignment.subject)} assignment is still pending${assignment.dueDate ? ` and due by ${new Date(assignment.dueDate).toLocaleDateString()}` : ""}.`,
      priority: "medium",
      sourceId: assignment.id,
      createdAt,
    });
  }

  reminders.push({
    id: `reminder_habit_${user.id}`,
    userId: user.id,
    kind: "habit",
    title: `Keep the streak breathing`,
    message: user.streak > 0
      ? `You are on a ${user.streak}-day streak. Protect it like it owes you money.`
      : "No active streak yet. One focused session today fixes that quickly.",
    priority: "low",
    sourceId: null,
    createdAt,
  });

  return reminders;
}

function syncProfileMemory(
  memory: StoredOriginAiProfileMemory,
  user: StoredUser,
  latestResult: StoredTestResult | null,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
): void {
  memory.preferredName = memory.preferredName?.trim() || firstName(user);
  memory.identitySummary = [
    `${user.name} is a ${user.role}`,
    user.selectedCourse ? `preparing for ${user.selectedCourse}` : null,
    user.studentClass ? `class ${user.studentClass}` : null,
    user.fieldOfInterest ? `targeting ${user.fieldOfInterest}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  memory.lastWeakTopics = latestResult?.weakAreas.slice(0, 5).map((row) => row.topic) ?? [];
  memory.lastTestResultId = latestResult?.id ?? null;
  memory.lastVisitedPath = pageContext.pathname;
  memory.reminderDigest = reminders.slice(0, 5).map((row) => row.title);
  memory.updatedAt = nowIso();
}

function buildMemoryPayload(
  memory: StoredOriginAiProfileMemory,
  user: StoredUser,
  latestResult: StoredTestResult | null,
  store: AppStore,
): OriginAiMemoryPayload {
  return {
    preferredName: memory.preferredName?.trim() || firstName(user),
    identitySummary: memory.identitySummary?.trim() || `${user.name} is studying with Origin.`,
    pinnedFacts: memory.pinnedFacts,
    lastWeakTopics: memory.lastWeakTopics,
    pendingDppCount: store.dpps.filter((entry) => entry.userId === user.id && !entry.completed).length,
    pendingAssignmentCount: store.assignments.filter((entry) => entry.userId === user.id && !entry.completed).length,
    currentStreak: user.streak,
    lastTestSummary: latestResult?.aiAnalysis.summary ?? null,
  };
}

function serializeSession(session: StoredOriginAiSession): OriginAiSessionPayload {
  return {
    id: session.id,
    title: session.title,
    summary: session.summary,
    lastPathname: session.lastPathname,
    lastPageKind: session.lastPageKind,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: [...session.messages].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
  };
}

function buildWelcomeMessage(
  user: StoredUser,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pagePolicy: OriginAiPolicy,
): string {
  const topReminders = reminders.slice(0, 2).map((row) => row.title);
  const weakTopics = memory.lastWeakTopics.slice(0, 2);
  const pieces = [
    `Hey ${memory.preferredName}, I’m Origin AI.`,
    "I keep the useful study receipts, not the embarrassing ones.",
  ];

  if (weakTopics.length > 0) {
    pieces.push(`Last test wanted a rematch on ${weakTopics.join(" and ")}.`);
  }
  if (topReminders.length > 0) {
    pieces.push(`Right now I’d nudge you toward ${topReminders.join(" and ")}.`);
  }
  if (pagePolicy.mode !== "normal") {
    pieces.push(pagePolicy.reason);
  }

  pieces.push("Ask for a revision plan, concept help, or a quick study reset.");
  return pieces.join(" ");
}

function addAssistantMessage(session: StoredOriginAiSession, content: string, metadata: Record<string, unknown>) {
  session.messages.push({
    id: createId("origin_ai_msg"),
    role: "assistant",
    content,
    image: null,
    metadata,
    timestamp: nowIso(),
  });
  session.updatedAt = nowIso();
}

function ensureWelcomeTurn(
  session: StoredOriginAiSession,
  user: StoredUser,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pagePolicy: OriginAiPolicy,
): void {
  if (session.messages.length > 0) {
    return;
  }
  addAssistantMessage(session, buildWelcomeMessage(user, memory, reminders, pagePolicy), {
    source: "origin_ai_boot",
    provider: "local_fallback",
  });
}

function buildSystemInstruction(
  user: StoredUser,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
  pagePolicy: OriginAiPolicy,
): string {
  const soul = loadPromptDoc("SOUL.md");
  const agent = loadPromptDoc("AGENT.md");
  const reminderSummary = reminders
    .slice(0, 5)
    .map((reminder) => `- [${reminder.priority}] ${reminder.title}: ${reminder.message}`)
    .join("\n");

  return [
    soul,
    agent,
    "## Student Identity",
    `- Name: ${user.name}`,
    `- Role: ${user.role}`,
    `- Preferred name: ${memory.preferredName}`,
    `- Identity summary: ${memory.identitySummary}`,
    `- Selected course: ${user.selectedCourse ?? "unknown"}`,
    `- Streak: ${user.streak}`,
    memory.lastWeakTopics.length > 0
      ? `- Last weak topics: ${memory.lastWeakTopics.join(", ")}`
      : "- Last weak topics: none recorded",
    memory.lastTestSummary ? `- Last test summary: ${memory.lastTestSummary}` : "- Last test summary: none recorded",
    "## Live Reminders",
    reminderSummary || "- No reminders right now.",
    "## Current Page Context",
    `- Pathname: ${pageContext.pathname}`,
    `- Page kind: ${pageContext.pageKind}`,
    pageContext.title ? `- Page title/question: ${pageContext.title}` : "- Page title/question: unavailable",
    pageContext.subject ? `- Subject: ${pageContext.subject}` : "- Subject: unavailable",
    pageContext.chapter ? `- Chapter: ${pageContext.chapter}` : "- Chapter: unavailable",
    pageContext.concept ? `- Concept: ${pageContext.concept}` : "- Concept: unavailable",
    pageContext.hint ? `- Hint allowed on this page: ${pageContext.hint}` : "- Hint allowed on this page: unavailable",
    "## Page Policy",
    `- Mode: ${pagePolicy.mode}`,
    `- Reason: ${pagePolicy.reason}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildIntegrityReply(
  pageContext: OriginAiResolvedPageContext,
  memory: OriginAiMemoryPayload,
): string {
  return [
    `I’m in ${pageContext.pageKind === "test_active" ? "test" : "integrity"} mode right now, ${memory.preferredName}.`,
    "I won’t solve a live test question or hand over the direct answer while the attempt is active.",
    "What I *can* do:",
    "- help you calm the panic spiral",
    "- suggest a time-management move for the remaining section",
    "- tell you what to revise once you submit",
    "Tiny tough-love footnote: future-you likes honest marks more than suspiciously magical ones.",
  ].join("\n");
}

function buildHintOnlyReply(
  pageContext: OriginAiResolvedPageContext,
  memory: OriginAiMemoryPayload,
  userMessage: string,
): string {
  const hint = pageContext.hint?.trim() || `Start from the governing idea behind ${pageContext.concept ?? "this question"} before touching calculations.`;
  const concept = pageContext.concept ?? pageContext.chapter ?? "the current concept";
  const promptNudge = /answer|solve|final|direct/i.test(userMessage)
    ? "I’m keeping the final answer locked. You’re getting the coaching version, not the spoiler DLC."
    : "Good instinct. Let’s stay in hint mode and keep your attempt honest.";

  return [
    `${memory.preferredName}, I’m in OGCode hint mode.`,
    promptNudge,
    `Focus area: ${concept}.`,
    `Hint: ${hint}`,
    "Next best move: tell me which step feels foggy, and I’ll nudge only that step.",
  ].join("\n\n");
}

function buildLocalMentorReply(
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
  userMessage: string,
): string {
  const text = userMessage.toLowerCase();
  const weakTopics = memory.lastWeakTopics.slice(0, 3);

  if (/(plan|schedule|what should i do|what now|priority)/.test(text)) {
    const todo = reminders.slice(0, 3).map((row, index) => `${index + 1}. ${row.title} - ${row.message}`);
    return [
      `Here’s the cleanest next-step plan, ${memory.preferredName}:`,
      ...(todo.length > 0 ? todo : ["1. Do one short focused revision block.", "2. Solve one practice question.", "3. Close the loop with a recap."]),
      "If you want, I can compress this into a 20-minute rescue plan instead of a full study block.",
    ].join("\n");
  }

  if (/(weak|revise|revision|mistake|last test|where did i mess up)/.test(text) && weakTopics.length > 0) {
    return [
      `Your latest weak topics were ${weakTopics.join(", ")}.`,
      memory.lastTestSummary ?? "The last result says there is room to tighten conceptual accuracy.",
      "Pick one of those topics and I’ll break it into: core idea, common trap, and a fast revision drill.",
    ].join("\n\n");
  }

  if (pageContext.pageKind === "dpp") {
    return [
      `You’re on the DPP page, ${memory.preferredName}.`,
      `Pending DPP count: ${memory.pendingDppCount}.`,
      "Best move here: finish one incomplete set before jumping to a new shiny topic. Your brain prefers closure even when your tabs do not.",
    ].join("\n\n");
  }

  if (pageContext.pageKind === "study_corner") {
    return [
      "You’re in Study Corner.",
      "Ask me to build a revision plan for a chapter, turn a topic into quick bullet notes, or decide what to read next.",
    ].join("\n\n");
  }

  return [
    `Hey ${memory.preferredName}, I’ve got your study context loaded.`,
    memory.pendingDppCount > 0
      ? `You still have ${memory.pendingDppCount} pending DPP${memory.pendingDppCount === 1 ? "" : "s"}.`
      : "No pending DPP emergencies at the moment.",
    weakTopics.length > 0
      ? `The last weak-topic trail points to ${weakTopics.join(", ")}.`
      : "I don’t have a weak-topic alert from your last test yet.",
    "Tell me whether you want concept help, a revision plan, or a reminder list and I’ll keep it tight.",
  ].join(" ");
}

function maybeUpdatePinnedFacts(memory: StoredOriginAiProfileMemory, userMessage: string): void {
  const preferredNameMatch = userMessage.match(/\bcall me\s+([a-z][a-z\s'-]{1,30})/i);
  if (preferredNameMatch) {
    memory.preferredName = preferredNameMatch[1].trim().replace(/\s+/g, " ");
  }

  const remindMeMatch = userMessage.match(/\bremind me to\s+(.{3,80})/i);
  if (remindMeMatch) {
    const reminder = remindMeMatch[1].trim().replace(/[.?!]+$/, "");
    if (reminder && !memory.pinnedFacts.includes(`Reminder: ${reminder}`)) {
      memory.pinnedFacts = [`Reminder: ${reminder}`, ...memory.pinnedFacts].slice(0, 8);
    }
  }
}

async function generateAssistantReply(
  user: StoredUser,
  session: StoredOriginAiSession,
  memory: OriginAiMemoryPayload,
  reminders: StoredOriginAiReminder[],
  pageContext: OriginAiResolvedPageContext,
  pagePolicy: OriginAiPolicy,
  userMessage: string,
): Promise<{ content: string; provider: string; model: string; metadata: Record<string, unknown> }> {
  if (pagePolicy.mode === "answer_blocked") {
    return {
      content: buildIntegrityReply(pageContext, memory),
      provider: "local_fallback",
      model: "guardrail",
      metadata: { mode: pagePolicy.mode, source: "origin_ai_guardrail" },
    };
  }

  if (pagePolicy.mode === "hint_only") {
    return {
      content: buildHintOnlyReply(pageContext, memory, userMessage),
      provider: "local_fallback",
      model: "hint_guardrail",
      metadata: { mode: pagePolicy.mode, source: "origin_ai_hint_guardrail" },
    };
  }

  const history = session.messages.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const providerRequest: OriginAiProviderRequest = {
    requestId: createId("origin_ai_req"),
    systemInstruction: buildSystemInstruction(user, memory, reminders, pageContext, pagePolicy),
    conversation: [...history, { role: "user", content: userMessage }],
  };

  const providerReply = await generateOriginAiProviderReply(providerRequest);
  if (providerReply?.content.trim()) {
    return {
      content: providerReply.content.trim(),
      provider: providerReply.provider,
      model: providerReply.model,
      metadata: providerReply.metadata ?? {},
    };
  }

  return {
    content: buildLocalMentorReply(memory, reminders, pageContext, userMessage),
    provider: "local_fallback",
    model: "local-context-mentor",
    metadata: { source: "origin_ai_local_fallback" },
  };
}

function maybeAwardOriginAiPoints(store: AppStore, user: StoredUser, referenceId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const awardedToday = store.pointLogs
    .filter((entry) => entry.userId === user.id && entry.activityType === "origin_ai" && entry.timestamp.slice(0, 10) === today)
    .reduce((total, entry) => total + entry.points, 0);

  if (awardedToday >= 25) {
    return;
  }

  const points = Math.min(5, 25 - awardedToday);
  if (points <= 0) {
    return;
  }

  awardPoints(store, user.id, points, "origin_ai", "Checked in with Origin AI mentor", referenceId);
}

export async function getOriginAiSnapshot(
  store: AppStore,
  user: StoredUser,
  request: Request,
  input?: OriginAiPageContextInput | null,
): Promise<OriginAiSnapshotPayload> {
  const pageContext = await resolvePageContext(store, user, request, input);
  const pagePolicy = resolvePagePolicy(pageContext);
  const latestResult = getLatestResult(store, user.id);
  const memory = getOrCreateProfileMemory(store, user);
  const reminders = buildReminders(store, user, latestResult);
  syncProfileMemory(memory, user, latestResult, reminders, pageContext);
  const memoryPayload = buildMemoryPayload(memory, user, latestResult, store);

  store.originAiReminders = [
    ...store.originAiReminders.filter((entry) => entry.userId !== user.id),
    ...reminders,
  ];

  const session = getOrCreateMentorSession(store, user);
  session.lastPathname = pageContext.pathname;
  session.lastPageKind = pageContext.pageKind;
  ensureWelcomeTurn(session, user, memoryPayload, reminders, pagePolicy);

  return {
    session: serializeSession(session),
    memory: memoryPayload,
    reminders,
    pageContext,
    pagePolicy,
    provider: "bootstrap",
  };
}

export async function sendOriginAiMessage(
  store: AppStore,
  user: StoredUser,
  request: Request,
  userContent: string,
  input?: OriginAiPageContextInput | null,
): Promise<OriginAiReplyPayload | { error: string }> {
  const trimmed = userContent.trim();
  if (!trimmed) {
    return { error: "Message is required." };
  }

  const pageContext = await resolvePageContext(store, user, request, input);
  const pagePolicy = resolvePagePolicy(pageContext);
  const latestResult = getLatestResult(store, user.id);
  const reminders = buildReminders(store, user, latestResult);
  const memoryRecord = getOrCreateProfileMemory(store, user);
  syncProfileMemory(memoryRecord, user, latestResult, reminders, pageContext);
  maybeUpdatePinnedFacts(memoryRecord, trimmed);
  const memoryPayload = buildMemoryPayload(memoryRecord, user, latestResult, store);

  store.originAiReminders = [
    ...store.originAiReminders.filter((entry) => entry.userId !== user.id),
    ...reminders,
  ];

  const session = getOrCreateMentorSession(store, user);
  session.lastPathname = pageContext.pathname;
  session.lastPageKind = pageContext.pageKind;

  const userMessage: StoredChatMessage = {
    id: createId("origin_ai_msg"),
    role: "user",
    content: trimmed,
    image: null,
    metadata: {
      pathname: pageContext.pathname,
      pageKind: pageContext.pageKind,
    },
    timestamp: nowIso(),
  };
  session.messages.push(userMessage);

  const assistantTurn = await generateAssistantReply(
    user,
    session,
    memoryPayload,
    reminders,
    pageContext,
    pagePolicy,
    trimmed,
  );

  const aiMessage: StoredChatMessage = {
    id: createId("origin_ai_msg"),
    role: "assistant",
    content: assistantTurn.content,
    image: null,
    metadata: {
      source: "origin_ai",
      provider: assistantTurn.provider,
      model: assistantTurn.model,
      pageKind: pageContext.pageKind,
      policyMode: pagePolicy.mode,
      ...assistantTurn.metadata,
    },
    timestamp: nowIso(),
  };

  session.messages.push(aiMessage);
  session.updatedAt = nowIso();
  maybeAwardOriginAiPoints(store, user, aiMessage.id);

  return {
    userMessage,
    aiMessage,
    session: serializeSession(session),
    memory: buildMemoryPayload(memoryRecord, user, latestResult, store),
    reminders,
    pageContext,
    pagePolicy,
    provider: assistantTurn.provider,
  };
}
