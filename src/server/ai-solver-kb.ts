import fs from "node:fs";
import path from "node:path";

const ATOM_TYPE_ORDER: Record<string, string[]> = {
  quick: ["INTUITION", "FORMULA", "MISTAKE_WARN"],
  medium: ["INTUITION", "FORMULA", "EXAMPLE", "MISTAKE_WARN"],
  deep: [
    "INTUITION",
    "FORMULA",
    "DERIVATION_STEP",
    "ANALOGY",
    "EXAMPLE",
    "MISTAKE_WARN",
    "SOCRATIC_PROBE",
  ],
};

const STEP_TITLES: Record<string, string> = {
  INTUITION: "Core Intuition",
  FORMULA: "Key Formula",
  DERIVATION_STEP: "Why This Works",
  ANALOGY: "Think of It Like This",
  EXAMPLE: "Worked Example",
  MISTAKE_WARN: "Trap to Avoid",
  SOCRATIC_PROBE: "Challenge Check",
};

const STOPWORDS = new Set([
  "what",
  "when",
  "where",
  "which",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "about",
  "please",
  "explain",
  "concept",
  "problem",
  "question",
  "physics",
  "chapter",
  "formula",
  "equation",
  "principle",
  "solve",
  "help",
]);

const REFLEX_PATTERNS: Array<[RegExp, string]> = [
  [/\b(yes|yeah|yep|ok|okay|sure|got it|understood)\b/, "Good. Push one layer deeper now and ask me where the confusion still remains."],
  [/\b(thanks|thank you)\b/, "Keep going. Ask for an example, derivation, or common trap and I will sharpen the same concept further."],
  [/\b(wait|slow down|hold on)\b/, "Let's slow it down. Tell me the exact line that feels confusing and I will unwrap only that part."],
];

const INTENT_RULES: Array<[string, RegExp[], string[]]> = [
  ["challenge", [/\b(challenge me|quiz me|test me|probe me)\b/], ["SOCRATIC_PROBE"]],
  ["derivation", [/\b(derive|derivation|prove|how do we get|where does .* come from)\b/], ["DERIVATION_STEP", "FORMULA"]],
  ["example", [/\b(example|numerical|solve|worked out|practice problem)\b/], ["EXAMPLE", "FORMULA"]],
  ["analogy", [/\b(analogy|intuitive|real life|simple words|everyday)\b/], ["ANALOGY", "INTUITION"]],
  ["mistakes", [/\b(mistake|trap|avoid|common error|where do students go wrong)\b/], ["MISTAKE_WARN"]],
  ["formula", [/\b(formula|equation|expression|mathematical)\b/], ["FORMULA", "INTUITION"]],
  ["why", [/\b(why|depend on|proportional|squared|change if)\b/], ["DERIVATION_STEP", "ANALOGY", "INTUITION"]],
];

interface TeachingAtom {
  atom_id: string;
  concept: string;
  atom_type: string;
  content: string;
  source?: string;
  use_count?: number;
  created_at?: number;
}

interface ConceptAssets {
  knowledgeBase: Record<string, TeachingAtom[]>;
  conceptGraph: {
    concepts?: string[];
    prerequisites?: Record<string, string[]>;
  };
  concepts: string[];
  conceptTokens: Record<string, Set<string>>;
  normalizedConcepts: Record<string, string>;
}

export interface KnowledgeSolverTurn {
  content: string;
  metadata: Record<string, unknown>;
  activeConcept: string | null;
  suggestedTitle: string | null;
}

export interface KnowledgeSolverInput {
  sessionTitle: string;
  sessionSubject: string;
  activeConcept: string | null;
  studentInput: string;
  image?: string | null;
}

let assetCache: ConceptAssets | null = null;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function clampText(value: string, limit = 650): string {
  const stripped = value.replace(/\s+/g, " ").trim();
  return stripped.length <= limit ? stripped : `${stripped.slice(0, limit - 3).trimEnd()}...`;
}

function loadAssets(): ConceptAssets {
  if (assetCache) {
    return assetCache;
  }

  const dataDir = path.join(process.cwd(), "..", "Backend", "interaction", "ai_solver", "data");
  const knowledgeBase = JSON.parse(
    fs.readFileSync(path.join(dataDir, "knowledge_base.json"), "utf8"),
  ) as Record<string, TeachingAtom[]>;
  const conceptGraph = JSON.parse(
    fs.readFileSync(path.join(dataDir, "concept_graph.json"), "utf8"),
  ) as ConceptAssets["conceptGraph"];

  const concepts = Object.keys(knowledgeBase);
  const conceptTokens = Object.fromEntries(
    concepts.map((concept) => [concept, new Set(tokenize(concept))]),
  );
  const normalizedConcepts = Object.fromEntries(
    concepts.map((concept) => [concept, normalizeText(concept)]),
  );

  assetCache = {
    knowledgeBase,
    conceptGraph,
    concepts,
    conceptTokens,
    normalizedConcepts,
  };
  return assetCache;
}

function candidateConcepts(text: string): Array<{ concept: string; score: number }> {
  const assets = loadAssets();
  const normalizedQuery = normalizeText(text);
  const queryTokens = new Set(tokenize(text));
  const candidates: Array<{ concept: string; score: number }> = [];

  for (const concept of assets.concepts) {
    const conceptTokens = assets.conceptTokens[concept];
    const conceptNorm = assets.normalizedConcepts[concept];
    const overlap = [...queryTokens].filter((token) => conceptTokens.has(token));
    let score = 0;

    if (conceptNorm && normalizedQuery.includes(conceptNorm)) {
      score += 10;
    }

    for (const token of overlap) {
      score += 2;
      if (token.length >= 8) {
        score += 1.5;
      }
    }

    if (overlap.length >= 2) {
      score += 1;
    }

    if (score > 0) {
      candidates.push({ concept, score });
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

function detectConcept(text: string, fallbackConcept: string | null): string | null {
  const candidates = candidateConcepts(text);
  const best = candidates[0];
  if (!best) {
    return fallbackConcept;
  }

  if (best.score >= 4) {
    return best.concept;
  }

  return fallbackConcept;
}

function atomsForConcept(concept: string): TeachingAtom[] {
  return loadAssets().knowledgeBase[concept] ?? [];
}

function pickAtoms(concept: string, atomTypes: string[]): TeachingAtom[] {
  const atoms = atomsForConcept(concept);
  return atomTypes
    .map((atomType) => atoms.find((atom) => atom.atom_type === atomType))
    .filter((atom): atom is TeachingAtom => Boolean(atom));
}

function buildStep(atom: TeachingAtom): string {
  return `**${STEP_TITLES[atom.atom_type] ?? atom.atom_type}:** ${clampText(atom.content)}`;
}

function checkReadiness(concept: string): { ready: boolean; missing: string[] } {
  const prereqs = loadAssets().conceptGraph.prerequisites?.[concept] ?? [];
  return {
    ready: prereqs.length === 0,
    missing: prereqs.slice(0, 3),
  };
}

function matchIntent(studentInput: string): { intent: string; atomTypes: string[]; reflex?: string } {
  const normalized = normalizeText(studentInput);

  for (const [pattern, response] of REFLEX_PATTERNS) {
    if (pattern.test(normalized)) {
      return { intent: "reflex", atomTypes: [], reflex: response };
    }
  }

  for (const [intent, patterns, atomTypes] of INTENT_RULES) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return { intent, atomTypes };
    }
  }

  return { intent: "clarify", atomTypes: ["INTUITION", "FORMULA"] };
}

function buildConceptClarifier(studentInput: string): KnowledgeSolverTurn {
  const suggestions = candidateConcepts(studentInput)
    .slice(0, 3)
    .map((entry) => `**${entry.concept}**`)
    .join(", ");

  const content = suggestions
    ? [
        "I need the exact Physics concept before I can explain this properly.",
        `Closest HC Verma concept matches are: ${suggestions}.`,
        "Reply with the concept name, or paste the most important line from the problem statement.",
      ].join("\n\n<!-- step -->\n\n")
    : [
        "I could not lock onto the concept from that message alone.",
        "Tell me the chapter, the core formula, or the exact phenomenon involved.",
        "For example: *Circular Motion*, *Work-Energy Theorem*, or *Newton's Laws of Motion*.",
      ].join("\n\n<!-- step -->\n\n");

  return {
    content,
    activeConcept: null,
    suggestedTitle: null,
    metadata: {
      persona: "Explainer",
      source: "hc_verma_concept_clarifier",
      stage: "awaiting_concept",
      llmCalled: false,
    },
  };
}

export function solveWithKnowledgeBase(input: KnowledgeSolverInput): KnowledgeSolverTurn {
  const studentInput = (input.studentInput || "").trim();

  if (input.image && !studentInput) {
    return {
      content: [
        "I received the image, but this version still needs the problem text or the concept name to reason reliably.",
        "**What to send next:** type the question statement, the chapter name, or the exact formula you are stuck on.",
        "**Fastest path:** mention the concept or paste the most important line and I will take over from there.",
      ].join("\n\n<!-- step -->\n\n"),
      activeConcept: input.activeConcept,
      suggestedTitle: null,
      metadata: {
        persona: "Explainer",
        source: "hc_verma_image_clarifier",
        stage: "awaiting_problem_text",
        llmCalled: false,
      },
    };
  }

  const combined = [studentInput, input.sessionTitle].filter(Boolean).join(" ");
  const detectedConcept = detectConcept(combined, input.activeConcept);
  if (!detectedConcept) {
    return buildConceptClarifier(studentInput);
  }

  const activeConcept = input.activeConcept;
  const explainConcept = !activeConcept || activeConcept !== detectedConcept;
  const readiness = checkReadiness(detectedConcept);

  if (explainConcept) {
    const atoms = pickAtoms(detectedConcept, ATOM_TYPE_ORDER.medium);
    const parts = [`Let's solve **${detectedConcept}** the right way.`];
    if (!readiness.ready && readiness.missing.length > 0) {
      parts.push(
        `**Foundation Check:** Before this topic becomes easy, keep **${readiness.missing.join(", ")}** warm in your head.`,
      );
    }
    parts.push(...atoms.map(buildStep));

    return {
      content: parts.join("\n\n<!-- step -->\n\n"),
      activeConcept: detectedConcept,
      suggestedTitle: `${input.sessionSubject} - ${detectedConcept}`,
      metadata: {
        persona: "Explainer",
        source: "hc_verma_atom_compilation",
        stage: "concept_explanation",
        concept: detectedConcept,
        llmCalled: false,
        readiness,
      },
    };
  }

  const intent = matchIntent(studentInput);
  if (intent.intent === "reflex" && intent.reflex) {
    return {
      content: intent.reflex,
      activeConcept: detectedConcept,
      suggestedTitle: `${input.sessionSubject} - ${detectedConcept}`,
      metadata: {
        persona: "Explainer",
        source: "hc_verma_reflex",
        stage: "followup",
        concept: detectedConcept,
        intent: "reflex",
        llmCalled: false,
      },
    };
  }

  const atomTypes = intent.atomTypes.length > 0 ? intent.atomTypes : ATOM_TYPE_ORDER.medium;
  const atoms = pickAtoms(detectedConcept, atomTypes).slice(0, 3);
  const parts = [`Let's stay on **${detectedConcept}** and attack exactly what you asked.`];
  parts.push(...atoms.map(buildStep));
  if (intent.intent === "challenge" && !atoms.some((atom) => atom.atom_type === "SOCRATIC_PROBE")) {
    parts.push(
      "**Challenge Check:** Before you look back at the formula, tell me what physical quantity controls this result most strongly.",
    );
  }

  return {
    content: parts.join("\n\n<!-- step -->\n\n"),
    activeConcept: detectedConcept,
    suggestedTitle: `${input.sessionSubject} - ${detectedConcept}`,
    metadata: {
      persona: "Explainer",
      source: "hc_verma_atom_assembly",
      stage: "followup",
      concept: detectedConcept,
      intent: intent.intent,
      llmCalled: false,
      readiness,
    },
  };
}
