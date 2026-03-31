import { awardPoints } from "@/server/gamification";
import {
  createId,
  type AppStore,
  type StoredChatMessage,
  type StoredDoubtSession,
  type StoredUser,
} from "@/server/store";

interface CreateSessionInput {
  title?: string;
  subject?: string;
}

interface UpdateSessionInput {
  title?: string;
  subject?: string;
}

interface AddMessageInput {
  content?: string;
  image?: string;
}

interface SolverTurn {
  content: string;
  metadata: Record<string, unknown>;
  activeConcept?: string | null;
  suggestedTitle?: string | null;
}

const GENERIC_SESSION_TITLES = new Set([
  "new physics session",
  "physics doubt session",
  "physics - image analysis",
]);

const CONCEPT_KEYWORDS: Array<{ concept: string; keywords: string[] }> = [
  { concept: "Energy Stored in a Capacitor", keywords: ["capacitor", "stored energy", "electric field"] },
  { concept: "Newton's Laws of Motion", keywords: ["newton", "force", "acceleration"] },
  { concept: "Circular Motion", keywords: ["circular", "centripetal", "radius"] },
  { concept: "Redox Reactions", keywords: ["redox", "oxidation", "reduction"] },
  { concept: "pH and Equilibrium", keywords: ["ph", "acid", "base", "equilibrium"] },
  { concept: "Trigonometric Integration", keywords: ["integration", "sin", "cos", "integral"] },
];

const CONCEPT_EXPLAINERS: Record<string, string[]> = {
  "Energy Stored in a Capacitor": [
    "A capacitor stores energy in the electric field between its plates.",
    "Use **U = (1/2) C V²** or **U = Q²/(2C)** depending on what is known.",
    "Keep units consistent: `C` in farads, `V` in volts, result in joules.",
  ],
  "Newton's Laws of Motion": [
    "Start with a force diagram before writing equations.",
    "Then apply **F = m a** component-wise along chosen axes.",
    "Check sign conventions before solving numerically.",
  ],
  "Circular Motion": [
    "For circular motion, the acceleration toward center is **a = v² / r**.",
    "Required inward force is **F = m v² / r**.",
    "If the object leaves the curve, usually the inward-force condition failed.",
  ],
  "Redox Reactions": [
    "Track oxidation number change first, then balance electrons.",
    "Total electrons lost must equal total electrons gained.",
    "Finally balance charge and atoms with `H+`, `OH-`, and `H2O` as needed.",
  ],
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

function shouldAutoRenameSession(title: string): boolean {
  const normalized = normalizeText(title);
  return GENERIC_SESSION_TITLES.has(normalized) || normalized.startsWith("new physics");
}

function detectConcept(content: string, activeConcept: string | null): string | null {
  const normalized = normalizeText(content);
  if (!normalized) {
    return activeConcept;
  }

  for (const rule of CONCEPT_KEYWORDS) {
    if (rule.keywords.some((token) => normalized.includes(token))) {
      return rule.concept;
    }
  }
  return activeConcept;
}

function isFollowupQuery(content: string): boolean {
  const normalized = normalizeText(content);
  return [
    "example",
    "numerical",
    "derive",
    "derivation",
    "mistake",
    "trap",
    "why",
    "how",
    "challenge",
    "quiz",
  ].some((token) => normalized.includes(token));
}

function extractSolverContent(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

async function callExternalSolver(
  session: StoredDoubtSession,
  user: StoredUser,
  input: AddMessageInput,
): Promise<SolverTurn | null> {
  const base = process.env.AI_SOLVER_SERVICE_URL?.trim();
  if (!base) {
    return null;
  }

  const candidateUrls = base.endsWith("/solve") ? [base] : [`${base.replace(/\/$/, "")}/solve`, base];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session: {
            id: session.id,
            title: session.title,
            subject: session.subject,
            activeConcept: session.activeConcept,
            messages: session.messages.slice(-20),
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          input: {
            content: input.content ?? "",
            image: input.image ?? null,
          },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const content =
        extractSolverContent(data.reply) ??
        extractSolverContent(data.response) ??
        extractSolverContent(data.answer) ??
        extractSolverContent((data.aiMessage as Record<string, unknown> | undefined)?.content);

      if (!content) {
        continue;
      }

      const metadataRaw =
        ((data.aiMessage as Record<string, unknown> | undefined)?.metadata as Record<string, unknown> | undefined) ??
        (data.metadata as Record<string, unknown> | undefined) ??
        {};
      const metadata: Record<string, unknown> = {
        ...metadataRaw,
        source: metadataRaw.source ?? "ai_solver_service",
        llmCalled: metadataRaw.llmCalled ?? true,
        serviceUrl: url,
      };

      const activeConcept =
        (typeof data.activeConcept === "string" && data.activeConcept) ||
        (typeof (data.session as Record<string, unknown> | undefined)?.activeConcept === "string"
          ? ((data.session as Record<string, unknown>)?.activeConcept as string)
          : null);
      const suggestedTitle =
        (typeof data.suggestedTitle === "string" && data.suggestedTitle) ||
        (typeof (data.session as Record<string, unknown> | undefined)?.title === "string"
          ? ((data.session as Record<string, unknown>)?.title as string)
          : null);

      return {
        content,
        metadata,
        activeConcept,
        suggestedTitle,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function buildFallbackReply(session: StoredDoubtSession, input: AddMessageInput): SolverTurn {
  const content = (input.content ?? "").trim();
  const concept = detectConcept(content, session.activeConcept);

  if (input.image && !content) {
    return {
      content:
        "I received the image. For this version, please add the problem text or concept name so I can solve it reliably.\n\n<!-- step -->\n\nShare the key line from the question and I will continue immediately.",
      metadata: {
        persona: "Explainer",
        source: "fallback_image_clarifier",
        stage: "awaiting_problem_text",
        llmCalled: false,
      },
      activeConcept: session.activeConcept,
    };
  }

  if (!concept) {
    const hints = CONCEPT_KEYWORDS.slice(0, 3).map((item) => item.concept).join(", ");
    return {
      content:
        `I need the exact concept to give a precise solve.\n\n<!-- step -->\n\nTry one of: **${hints}**.\n\n<!-- step -->\n\nOr paste the exact formula/problem statement line.`,
      metadata: {
        persona: "Explainer",
        source: "fallback_concept_clarifier",
        stage: "awaiting_concept",
        llmCalled: false,
      },
      activeConcept: null,
    };
  }

  const explainers = CONCEPT_EXPLAINERS[concept] ?? [
    `Let's break down **${concept}** carefully.`,
    "Identify what is given, what is asked, and which governing relation applies.",
    "Then solve step-by-step and validate units/signs at the end.",
  ];

  if (isFollowupQuery(content)) {
    return {
      content:
        `Let's stay on **${concept}** and handle your follow-up.\n\n<!-- step -->\n\n${explainers[0]}\n\n<!-- step -->\n\n${explainers[1]}\n\n<!-- step -->\n\nQuick check: reply with the exact step where you still feel stuck.`,
      metadata: {
        persona: "Explainer",
        source: "fallback_followup",
        stage: "followup",
        concept,
        llmCalled: false,
      },
      activeConcept: concept,
      suggestedTitle: `${session.subject} - ${concept}`,
    };
  }

  return {
    content:
      `Let's solve **${concept}** the right way.\n\n<!-- step -->\n\n${explainers[0]}\n\n<!-- step -->\n\n${explainers[1]}\n\n<!-- step -->\n\n${explainers[2]}`,
    metadata: {
      persona: "Explainer",
      source: "fallback_concept_explanation",
      stage: "concept_explanation",
      concept,
      llmCalled: false,
    },
    activeConcept: concept,
    suggestedTitle: `${session.subject} - ${concept}`,
  };
}

function toMessagePayload(message: StoredChatMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    image: message.image,
    metadata: message.metadata,
    timestamp: message.timestamp,
  };
}

export function toSessionPayload(session: StoredDoubtSession) {
  const messages = [...session.messages]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .map(toMessagePayload);

  return {
    id: session.id,
    title: session.title,
    subject: session.subject,
    activeConcept: session.activeConcept,
    active_concept: session.activeConcept,
    messages,
    createdAt: session.createdAt,
    created_at: session.createdAt,
    updatedAt: session.updatedAt,
    updated_at: session.updatedAt,
  };
}

export function listDoubtSessions(store: AppStore, userId: string) {
  return store.doubtSessions
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toSessionPayload);
}

export function getDoubtSession(store: AppStore, userId: string, sessionId: string) {
  const session = store.doubtSessions.find((entry) => entry.id === sessionId && entry.userId === userId);
  return session ? toSessionPayload(session) : null;
}

export function createDoubtSession(store: AppStore, userId: string, payload: CreateSessionInput) {
  const subject = (payload.subject?.trim() || "Physics").slice(0, 50);
  const title = (payload.title?.trim() || `New ${subject} Session`).slice(0, 255);
  const timestamp = nowIso();

  const session: StoredDoubtSession = {
    id: createId("doubt"),
    userId,
    title,
    subject,
    activeConcept: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
  store.doubtSessions.push(session);
  return toSessionPayload(session);
}

export function updateDoubtSession(
  store: AppStore,
  userId: string,
  sessionId: string,
  payload: UpdateSessionInput,
) {
  const session = store.doubtSessions.find((entry) => entry.id === sessionId && entry.userId === userId);
  if (!session) {
    return null;
  }

  if (typeof payload.title === "string" && payload.title.trim()) {
    session.title = payload.title.trim().slice(0, 255);
  }
  if (typeof payload.subject === "string" && payload.subject.trim()) {
    session.subject = payload.subject.trim().slice(0, 50);
  }
  session.updatedAt = nowIso();
  return toSessionPayload(session);
}

export function deleteDoubtSession(store: AppStore, userId: string, sessionId: string): boolean {
  const originalLength = store.doubtSessions.length;
  store.doubtSessions = store.doubtSessions.filter((entry) => !(entry.id === sessionId && entry.userId === userId));
  return store.doubtSessions.length !== originalLength;
}

export async function addSessionMessage(
  store: AppStore,
  user: StoredUser,
  sessionId: string,
  payload: AddMessageInput,
) {
  const session = store.doubtSessions.find((entry) => entry.id === sessionId && entry.userId === user.id);
  if (!session) {
    return null;
  }

  const textContent = (payload.content ?? "").trim();
  if (!textContent && !payload.image) {
    return { error: "Content or image is required" as const };
  }

  const userMessage: StoredChatMessage = {
    id: createId("chat"),
    role: "user",
    content: textContent,
    image: payload.image ?? null,
    metadata: {},
    timestamp: nowIso(),
  };
  session.messages.push(userMessage);

  const externalTurn = await callExternalSolver(session, user, payload);
  const solverTurn = externalTurn ?? buildFallbackReply(session, payload);

  if (typeof solverTurn.activeConcept === "string" && solverTurn.activeConcept.trim()) {
    session.activeConcept = solverTurn.activeConcept.trim();
  }

  const shouldRename = shouldAutoRenameSession(session.title);
  if (shouldRename && typeof solverTurn.suggestedTitle === "string" && solverTurn.suggestedTitle.trim()) {
    session.title = solverTurn.suggestedTitle.trim().slice(0, 255);
  }

  const aiMessage: StoredChatMessage = {
    id: createId("chat"),
    role: "assistant",
    content: solverTurn.content,
    image: null,
    metadata: {
      ...solverTurn.metadata,
      concept: session.activeConcept,
    },
    timestamp: nowIso(),
  };
  session.messages.push(aiMessage);
  session.updatedAt = nowIso();

  const today = new Date().toISOString().slice(0, 10);
  const dailySolverPoints = store.pointLogs
    .filter(
      (entry) =>
        entry.userId === user.id && entry.activityType === "ai_solver" && entry.timestamp.slice(0, 10) === today,
    )
    .reduce((total, entry) => total + entry.points, 0);

  if (dailySolverPoints < 25) {
    const pointsToAward = Math.min(5, 25 - dailySolverPoints);
    if (pointsToAward > 0) {
      awardPoints(
        store,
        user.id,
        pointsToAward,
        "ai_solver",
        `Resolved doubt in session: ${session.title}`,
        aiMessage.id,
      );
    }
  }

  const responseSession = toSessionPayload(session);
  return {
    userMessage: toMessagePayload(userMessage),
    user_message: toMessagePayload(userMessage),
    aiMessage: toMessagePayload(aiMessage),
    ai_message: toMessagePayload(aiMessage),
    session: responseSession,
  };
}
