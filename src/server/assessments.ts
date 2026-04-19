import {
  buildPointsSummary,
  buildTimeAnalytics,
  calculateTimedPracticeScore,
  getOrCreateDailyActivity,
  updateUserStreak,
  updateUserStudyTime,
  awardPoints,
} from "@/server/gamification";
import {
  getOgcodeCatalogQuestionById,
  getOgcodeCatalogQuestionMap,
  getOgcodeChallengeQuestion,
  incrementOgcodeCatalogQuestionStats,
  listOgcodeCatalogQuestions,
} from "@/server/ogcode-catalog";
import { gradePracticeAnswerWithService } from "@/server/grader-client";
import {
  analyzeDppAttemptWithService,
  analyzeSubmittedTestWithService,
  generateCustomTestWithService,
  type AnalyticsDppPlan,
  type AnalyticsGradedAttempt,
} from "@/server/analytics-client";
import {
  getAttemptedQuestionIdsForUser,
  getDppPlanDetail,
  getLatestDppAttemptForPlan,
  getPersistedCustomTest,
  getPersistedResultById,
  getRecentWeakTopicsForUser,
  listPendingDppPlans,
  listPersistedCustomTests,
  listPersistedTestResults,
  persistDppAttemptResult,
  persistGeneratedCustomTest,
  persistTestAnalysisResult,
  type PersistedCustomTestRecord,
  type PersistedDppAttemptRecord,
  type PersistedDppPlanRecord,
  type PersistedTestResultRecord,
} from "@/server/analytics-store";
import type {
  AppStore,
  DifficultyLevel,
  StoredQuestion,
  StoredSubjectRank,
  StoredTest,
  StoredTestResult,
  StoredUser,
  StoredUserAnswer,
} from "@/server/store";
import { createId } from "@/server/store";
import { isOgcodePostgresConfigured } from "@/server/postgres";

export type QuestionAnswerPayload = {
  question_id?: string | number;
  questionId?: string | number;
  selected_option?: number | null;
  selectedOption?: number | null;
  selected_options?: number[];
  selectedOptions?: number[];
  matrix_pairs?: number[][];
  matrixPairs?: number[][];
  answer_text?: string;
  answerText?: string;
  time_spent?: number;
  timeSpent?: number;
  is_marked_for_review?: boolean;
  isMarkedForReview?: boolean;
};

export type TestSubmissionPayload = {
  answers?: QuestionAnswerPayload[];
  time_taken?: number;
  timeTaken?: number;
  isMalpractice?: boolean;
  is_malpractice?: boolean;
};

export type PracticeSubmissionPayload = {
  selected_option?: number | null;
  selectedOption?: number | null;
  selected_options?: number[];
  selectedOptions?: number[];
  matrix_pairs?: number[][];
  matrixPairs?: number[][];
  answer_text?: string;
  answerText?: string;
  time_spent?: number;
  timeSpent?: number;
};

export type CustomTestPayload = {
  subject?: string;
  difficulty?: string;
  chapter?: string;
  question_count?: number;
};

export type UpdateOgcodeLocationPayload = {
  subject?: string;
  latitude?: number | null;
  longitude?: number | null;
  share?: boolean;
};

type TopicAccuracy = { topic: string; accuracy: number };

type GradeResult = {
  isCorrect: boolean;
  info: Record<string, unknown>;
};

type SubjectiveMatch = {
  isCorrect: boolean;
  score: number;
  threshold: number;
  matchedTerms: string[];
  missingTerms: string[];
  matchMethod: "exact" | "formula" | "semantic";
};

type ReviewEntry = {
  questionId: string;
  concept: string;
  status: "correct" | "incorrect";
  error: string;
  explanation: string;
  howToApproach: string;
};

function normalizeSubject(subject: string): string {
  return subject.toLowerCase();
}

function normalizeDifficulty(difficulty: string): DifficultyLevel {
  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard" || difficulty === "insane") {
    return difficulty;
  }
  return "medium";
}

function sortedNumbers(values: number[] | undefined | null): number[] {
  return [...(values ?? [])].sort((left, right) => left - right);
}

const SUPERSCRIPT_MAP = new Map<string, string>([
  ["\u2070", "0"],
  ["\u00b9", "1"],
  ["\u00b2", "2"],
  ["\u00b3", "3"],
  ["\u2074", "4"],
  ["\u2075", "5"],
  ["\u2076", "6"],
  ["\u2077", "7"],
  ["\u2078", "8"],
  ["\u2079", "9"],
  ["\u207b", "-"],
  ["\u207a", "+"],
]);

const GREEK_SYMBOL_MAP = new Map<string, string>([
  ["\u0391", "alpha"],
  ["\u03b1", "alpha"],
  ["\u0392", "beta"],
  ["\u03b2", "beta"],
  ["\u0393", "gamma"],
  ["\u03b3", "gamma"],
  ["\u0394", "delta"],
  ["\u03b4", "delta"],
  ["\u0395", "epsilon"],
  ["\u03b5", "epsilon"],
  ["\u0396", "zeta"],
  ["\u03b6", "zeta"],
  ["\u0397", "eta"],
  ["\u03b7", "eta"],
  ["\u0398", "theta"],
  ["\u03b8", "theta"],
  ["\u039b", "lambda"],
  ["\u03bb", "lambda"],
  ["\u039c", "mu"],
  ["\u03bc", "mu"],
  ["\u03a0", "pi"],
  ["\u03c0", "pi"],
  ["\u03a1", "rho"],
  ["\u03c1", "rho"],
  ["\u03a3", "sigma"],
  ["\u03c3", "sigma"],
  ["\u03c2", "sigma"],
  ["\u03a4", "tau"],
  ["\u03c4", "tau"],
  ["\u03a6", "phi"],
  ["\u03c6", "phi"],
  ["\u03a9", "omega"],
  ["\u03c9", "omega"],
]);

const WORD_NUMBER_MAP = new Map<string, string>([
  ["zero", "0"],
  ["one", "1"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
  ["ten", "10"],
]);

const STOPWORDS = new Set([
  "a",
  "all",
  "an",
  "and",
  "approximately",
  "approx",
  "are",
  "as",
  "at",
  "be",
  "by",
  "concept",
  "dependent",
  "does",
  "equals",
  "explained",
  "for",
  "from",
  "has",
  "have",
  "hence",
  "if",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "same",
  "that",
  "the",
  "their",
  "they",
  "then",
  "therefore",
  "this",
  "to",
  "value",
  "which",
  "will",
  "with",
]);

const TOKEN_ALIASES = new Map<string, string>([
  ["acts", "act"],
  ["acting", "act"],
  ["behaves", "behave"],
  ["behaving", "behave"],
  ["degrees", "degree"],
  ["sec", "second"],
  ["seconds", "second"],
  ["approximate", "approx"],
  ["approximation", "approx"],
  ["speed", "velocity"],
  ["velocities", "velocity"],
  ["accelerations", "acceleration"],
  ["opencircuit", "open_circuit"],
  ["shortcircuit", "short_circuit"],
  ["taninverse", "arctan"],
  ["arctangent", "arctan"],
  ["sininverse", "arcsin"],
  ["arcsine", "arcsin"],
  ["cosinverse", "arccos"],
  ["arccosine", "arccos"],
]);

const FORMULA_SIGNAL_TOKENS = new Set([
  "sin",
  "cos",
  "tan",
  "arcsin",
  "arccos",
  "arctan",
  "sqrt",
  "log",
  "ln",
  "pi",
  "infinity",
]);

function replaceMappedSymbols(value: string, replacements: Map<string, string>): string {
  return Array.from(value, (character) => replacements.get(character) ?? character).join("");
}

function replaceSuperscripts(value: string): string {
  return replaceMappedSymbols(value, SUPERSCRIPT_MAP);
}

function replaceGreekLetters(value: string): string {
  return replaceMappedSymbols(value, GREEK_SYMBOL_MAP);
}

function normalizeEquationText(value: string | null | undefined): string {
  let normalized = replaceGreekLetters(replaceSuperscripts(String(value ?? "").normalize("NFKC")));
  normalized = normalized.replace(/[\u2212\u2013\u2014]/g, "-");

  for (const [word, numeric] of WORD_NUMBER_MAP.entries()) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "gi"), ` ${numeric} `);
  }

  normalized = normalized
    .replace(/\\frac\s*{([^{}]+)}\s*{([^{}]+)}/g, " $1 / $2 ")
    .replace(/\\sqrt\s*{([^{}]+)}/g, " sqrt $1 ")
    .replace(/√\s*\(([^()]*)\)/g, " sqrt $1 ")
    .replace(/√\s*{([^{}]+)}/g, " sqrt $1 ")
    .replace(/√\s*([a-zA-Z0-9.]+)/g, " sqrt $1 ")
    .replace(/\\(?:times|cdot)/g, " x ")
    .replace(/\\(?:infty|infinity)/g, " infinity ")
    .replace(/\\tan\s*\^\s*\{\s*-?1\s*\}/g, " arctan ")
    .replace(/\\sin\s*\^\s*\{\s*-?1\s*\}/g, " arcsin ")
    .replace(/\\cos\s*\^\s*\{\s*-?1\s*\}/g, " arccos ")
    .replace(/\btan\s*\^\s*-?1\b/gi, " arctan ")
    .replace(/\bsin\s*\^\s*-?1\b/gi, " arcsin ")
    .replace(/\bcos\s*\^\s*-?1\b/gi, " arccos ")
    .replace(/\btan\s*-\s*1\b/gi, " arctan ")
    .replace(/\bsin\s*-\s*1\b/gi, " arcsin ")
    .replace(/\bcos\s*-\s*1\b/gi, " arccos ")
    .replace(/\bshort[\s-]*circuit\b/gi, " short_circuit ")
    .replace(/\bopen[\s-]*circuit\b/gi, " open_circuit ")
    .replace(/∞/g, " infinity ")
    .replace(/π/gi, " pi ")
    .replace(/[μµ]/g, " micro ")
    .replace(/[Ωω]/g, " ohm ")
    .replace(/°/g, " degree ")
    .replace(/×/g, " x ")
    .replace(/·/g, " ")
    .replace(/\b(\d+(?:\.\d+)?)\s*sec\b/gi, "$1 second ")
    .replace(/\b(\d+(?:\.\d+)?)\s*s\b/gi, "$1 second ")
    .replace(/\b(\d+(?:\.\d+)?)\s*cm\b/gi, "$1 centimeter ")
    .replace(/\b(\d+(?:\.\d+)?)\s*mm\b/gi, "$1 millimeter ")
    .replace(/\b(\d+(?:\.\d+)?)\s*kg\b/gi, "$1 kilogram ")
    .replace(/\b(\d+(?:\.\d+)?)\s*m\/s\b/gi, "$1 meter_per_second ")
    .replace(/\b(\d+(?:\.\d+)?)\s*m\/s\^?2\b/gi, "$1 meter_per_second_square ")
    .replace(/\b(\d+(?:\.\d+)?)\s*eV\b/g, "$1 electronvolt ")
    .replace(/[{}[\]()]/g, " ")
    .replace(/_/g, "")
    .replace(/([=:+\-*/^,;])/g, " $1 ")
    .replace(/[^\p{L}\p{N}_.%/+^=\-\s]/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function normalizeFreeText(value: string | null | undefined): string {
  return normalizeEquationText(value);
}

function compactSemanticText(value: string | null | undefined): string {
  return normalizeFreeText(value).replace(/\s+/g, "");
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getSemanticBand(score: number, threshold: number): "strong_match" | "accepted_match" | "near_match" | "weak_match" {
  if (score >= threshold + 0.12) {
    return "strong_match";
  }
  if (score >= threshold) {
    return "accepted_match";
  }
  if (score >= threshold - 0.08) {
    return "near_match";
  }
  return "weak_match";
}

function extractNumericValues(value: string | null | undefined): number[] {
  const matches = normalizeFreeText(value)
    .replace(/,/g, "")
    .match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi);

  return (matches ?? [])
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function stemToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ing") && token.length > 5) {
    return token.slice(0, -3);
  }
  if (token.endsWith("ed") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("es") && token.length > 4 && !token.endsWith("ses")) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function canonicalizeToken(token: string): string | null {
  if (!token) {
    return null;
  }

  if (/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/.test(token)) {
    const numeric = Number(token);
    return Number.isFinite(numeric) ? String(numeric) : token;
  }

  const squashed = token.replace(/_/g, "");
  const aliased = TOKEN_ALIASES.get(squashed) ?? token;
  const stemmed = stemToken(aliased);
  if (STOPWORDS.has(stemmed)) {
    return null;
  }
  if (stemmed.length <= 1 && !/^\d+$/.test(stemmed)) {
    return null;
  }
  return stemmed;
}

function extractSemanticTokens(value: string | null | undefined): string[] {
  return normalizeFreeText(value)
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9_.]/g, ""))
    .map(canonicalizeToken)
    .filter((token): token is string => Boolean(token));
}

function normalizeFormulaComponent(token: string): string | null {
  if (!token) {
    return null;
  }
  if (/^[=+\-*/^]$/.test(token)) {
    return token;
  }

  if (/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/.test(token)) {
    const numeric = Number(token);
    return Number.isFinite(numeric) ? String(numeric) : token;
  }

  const squashed = token.replace(/_/g, "");
  const aliased = TOKEN_ALIASES.get(squashed) ?? token;
  return aliased || null;
}

function extractFormulaComponents(value: string | null | undefined): string[] {
  return normalizeFreeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .map(normalizeFormulaComponent)
    .filter((token): token is string => Boolean(token));
}

function formulaComponentWeight(token: string): number {
  if (/^[=+\-*/^]$/.test(token)) {
    return 1.2;
  }
  if (/^[-+]?\d/.test(token)) {
    return 1.1;
  }
  if (FORMULA_SIGNAL_TOKENS.has(token)) {
    return 1.4;
  }
  if (token.length === 1) {
    return 1;
  }
  return 1.15;
}

function isOperatorToken(token: string): boolean {
  return /^[=+\-*/^]$/.test(token);
}

function isMalformedFormulaComponents(tokens: string[]): boolean {
  if (!tokens.length) {
    return true;
  }

  if (isOperatorToken(tokens[0]) || isOperatorToken(tokens[tokens.length - 1])) {
    return true;
  }

  for (let index = 1; index < tokens.length; index += 1) {
    if (isOperatorToken(tokens[index - 1]) && isOperatorToken(tokens[index])) {
      return true;
    }
  }

  return false;
}

function weightedMultisetCoverage(expectedTokens: string[], submittedTokens: string[]) {
  const submittedCounts = new Map<string, number>();
  submittedTokens.forEach((token) => {
    submittedCounts.set(token, (submittedCounts.get(token) ?? 0) + 1);
  });

  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  expectedTokens.forEach((token) => {
    const weight = formulaComponentWeight(token);
    totalWeight += weight;
    const count = submittedCounts.get(token) ?? 0;
    if (count > 0) {
      matchedWeight += weight;
      matchedTerms.push(token);
      submittedCounts.set(token, count - 1);
    } else {
      missingTerms.push(token);
    }
  });

  return {
    score: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    matchedTerms,
    missingTerms,
  };
}

function semanticTokenWeight(token: string): number {
  if (/^[-+]?\d/.test(token)) {
    return 2.5;
  }
  if (token.includes("_")) {
    return 1.8;
  }
  if (token.length >= 8) {
    return 1.5;
  }
  if (token.length >= 5) {
    return 1.2;
  }
  return 1;
}

function isCriticalSemanticToken(token: string): boolean {
  if (FORMULA_SIGNAL_TOKENS.has(token)) {
    return true;
  }
  return !/^\d/.test(token) && token.length >= 5;
}

function weightedCoverage(expectedTokens: string[], submittedTokens: string[]) {
  const submittedSet = new Set(submittedTokens);
  const uniqueExpected = [...new Set(expectedTokens)];
  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  uniqueExpected.forEach((token) => {
    const weight = semanticTokenWeight(token);
    totalWeight += weight;
    if (submittedSet.has(token)) {
      matchedWeight += weight;
      matchedTerms.push(token);
    } else {
      missingTerms.push(token);
    }
  });

  return {
    score: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    matchedTerms,
    missingTerms,
  };
}

function buildCharNgrams(value: string, size = 3): Set<string> {
  const compact = compactSemanticText(value);
  if (!compact) {
    return new Set();
  }
  if (compact.length <= size) {
    return new Set([compact]);
  }

  const grams = new Set<string>();
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.add(compact.slice(index, index + size));
  }
  return grams;
}

function diceSimilarity(left: string, right: string): number {
  const leftGrams = buildCharNgrams(left);
  const rightGrams = buildCharNgrams(right);
  if (!leftGrams.size || !rightGrams.size) {
    return leftGrams.size === rightGrams.size ? 1 : 0;
  }

  let overlap = 0;
  leftGrams.forEach((gram) => {
    if (rightGrams.has(gram)) {
      overlap += 1;
    }
  });

  return (2 * overlap) / (leftGrams.size + rightGrams.size);
}

type NumericComparison = {
  score: number | null;
  conflicting: boolean;
};

function compareNumericSignals(expectedValue: string | null | undefined, submittedValue: string | null | undefined): NumericComparison {
  const expectedNumbers = extractNumericValues(expectedValue);
  if (!expectedNumbers.length) {
    return { score: null, conflicting: false };
  }

  const submittedNumbers = extractNumericValues(submittedValue);
  if (!submittedNumbers.length) {
    return { score: 0, conflicting: false };
  }

  const usedIndices = new Set<number>();
  let matched = 0;

  expectedNumbers.forEach((expected) => {
    const tolerance = Math.max(Math.abs(expected) * 0.02, 0.01);
    const matchIndex = submittedNumbers.findIndex(
      (submitted, index) => !usedIndices.has(index) && Math.abs(submitted - expected) <= tolerance,
    );
    if (matchIndex >= 0) {
      matched += 1;
      usedIndices.add(matchIndex);
    }
  });

  return {
    score: matched / expectedNumbers.length,
    conflicting: matched === 0 && submittedNumbers.length > 0,
  };
}

function buildSemanticVariants(expectedValue: string | null | undefined): string[] {
  const raw = String(expectedValue ?? "").trim();
  if (!raw) {
    return [];
  }
  const formulaHeavy = isFormulaHeavy(raw);

  const variants = new Map<string, { source: "raw" | "context" | "alternative" | "equals"; density: number }>();
  const addVariant = (candidate: string, source: "raw" | "context" | "alternative" | "equals") => {
    const trimmed = candidate.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      return;
    }
    const density = extractSemanticTokens(trimmed).length + extractNumericValues(trimmed).length;
    variants.set(trimmed, { source, density });
  };

  addVariant(raw, "raw");
  if (!formulaHeavy) {
    const withoutParenthetical = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (withoutParenthetical && withoutParenthetical !== raw) {
      addVariant(withoutParenthetical, "context");
    }

    [...raw.matchAll(/\(([^)]*)\)/g)].forEach((match) => {
      addVariant(match[1], "context");
      if (match[1].includes(":")) {
        addVariant(match[1].split(":").slice(1).join(":").trim(), "context");
      }
    });

    if (raw.includes(":")) {
      addVariant(raw.split(":").slice(1).join(":").trim(), "context");
    }
  }

  const pending = [...variants.keys()];
  pending.forEach((candidate) => {
    if (candidate.includes("=")) {
      addVariant(candidate.split("=").slice(1).join("=").trim(), "equals");
    }
    if (/\bor\b/i.test(candidate)) {
      candidate
        .split(/\bor\b/i)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => addVariant(part, "alternative"));
    }
  });

  const rawDensity = variants.get(raw)?.density ?? 0;
  return [...variants.entries()]
    .filter(([, meta]) => {
      if (meta.source === "raw" || meta.source === "alternative" || meta.source === "equals") {
        return true;
      }
      return meta.density >= Math.max(2, Math.ceil(rawDensity * 0.5));
    })
    .map(([candidate]) => candidate);
}

function contextCoverage(question: StoredQuestion, submittedTokens: string[]): number {
  const contextReference = `${question.concept ?? ""} ${String(question.explanation ?? "").split(/[.?!]/)[0] ?? ""}`;
  const contextTokens = extractSemanticTokens(contextReference).slice(0, 8);
  if (!contextTokens.length) {
    return 0;
  }
  return weightedCoverage(contextTokens, submittedTokens).score;
}

function isFormulaHeavy(value: string): boolean {
  return /[=\\/^*+\-]|arctan|arcsin|arccos|sqrt|pi|infinity|short_circuit|open_circuit/.test(
    normalizeFreeText(value),
  );
}

function evaluateSubjectiveVariant(
  question: StoredQuestion,
  expectedVariant: string,
  submittedValue: string | null | undefined,
): SubjectiveMatch {
  if (!compactSemanticText(submittedValue)) {
    return {
      isCorrect: false,
      score: 0,
      threshold: 1,
      matchedTerms: [],
      missingTerms: extractSemanticTokens(expectedVariant),
      matchMethod: "semantic",
    };
  }

  const submittedTokens = extractSemanticTokens(submittedValue);
  const expectedTokens = extractSemanticTokens(expectedVariant);
  const coverage = weightedCoverage(expectedTokens, submittedTokens);
  const criticalExpectedTokens = expectedTokens.filter(isCriticalSemanticToken);
  const criticalCoverage = weightedCoverage(criticalExpectedTokens, submittedTokens);
  const nonNumericCriticalCoverage = weightedCoverage(
    criticalExpectedTokens.filter((token) => !/^\d/.test(token)),
    submittedTokens,
  );
  const numericComparison = compareNumericSignals(expectedVariant, submittedValue);
  const formulaScore = diceSimilarity(expectedVariant, submittedValue ?? "");
  const contextScore = contextCoverage(question, submittedTokens);
  const formulaHeavy = isFormulaHeavy(expectedVariant);
  const submittedFormulaComponents = formulaHeavy ? extractFormulaComponents(submittedValue) : [];
  const formulaStructure = formulaHeavy
    ? weightedMultisetCoverage(
        extractFormulaComponents(expectedVariant),
        submittedFormulaComponents,
      )
    : null;
  const malformedFormula = formulaHeavy && isMalformedFormulaComponents(submittedFormulaComponents);

  const components: Array<[number, number]> = formulaHeavy
    ? [
        [coverage.score, 0.25],
        [formulaScore, 0.25],
      ]
    : [
        [coverage.score, 0.58],
        [formulaScore, 0.22],
      ];

  if (formulaStructure) {
    components.push([formulaStructure.score, 0.3]);
  }

  if (numericComparison.score !== null) {
    components.push([numericComparison.score, formulaHeavy ? 0.14 : 0.14]);
  }
  if (contextScore > 0) {
    components.push([Math.min(contextScore, 0.8), formulaHeavy ? 0.06 : 0.06]);
  }

  const totalWeight = components.reduce((sum, [, weight]) => sum + weight, 0);
  let score =
    totalWeight > 0
      ? components.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight
      : 0;

  const semanticDensity = Math.max(expectedTokens.length, extractNumericValues(expectedVariant).length);
  let threshold = formulaHeavy ? 0.68 : 0.72;
  if (semanticDensity >= 5) {
    threshold -= 0.06;
  } else if (semanticDensity <= 2) {
    threshold += 0.08;
  }

  const exactCompactMatch = compactSemanticText(expectedVariant) === compactSemanticText(submittedValue);
  if (exactCompactMatch) {
    return {
      isCorrect: true,
      score: 1,
      threshold,
      matchedTerms: coverage.matchedTerms,
      missingTerms: coverage.missingTerms,
      matchMethod: "exact",
    };
  }

  if (coverage.score >= 0.95 || formulaScore >= 0.94) {
    score = Math.max(score, threshold);
  }

  if (
    !formulaHeavy &&
    nonNumericCriticalCoverage.score === 1 &&
    nonNumericCriticalCoverage.matchedTerms.length > 0 &&
    (numericComparison.score === 1 || formulaScore >= 0.55)
  ) {
    score = Math.max(score, threshold);
  }

  if (
    numericComparison.score === 1 &&
    (formulaScore >= 0.55 || coverage.score >= 0.6) &&
    (!formulaHeavy || criticalCoverage.score >= 0.8)
  ) {
    score = Math.max(score, threshold);
  }

  if (numericComparison.conflicting && coverage.score < 0.85 && formulaScore < 0.85) {
    score = Math.min(score, threshold - 0.15);
  }

  if (formulaHeavy && criticalCoverage.score < 0.55) {
    score = Math.min(score, threshold - (criticalCoverage.score < 0.25 ? 0.18 : 0.08));
  }

  if (formulaHeavy && formulaStructure && formulaStructure.score < 0.88) {
    score = Math.min(score, threshold - (formulaStructure.score < 0.72 ? 0.2 : 0.1));
  }

  if (malformedFormula) {
    score = Math.min(score, threshold - 0.28);
  }

  score = clamp01(score);
  threshold = clamp01(threshold);

  const matchMethod: SubjectiveMatch["matchMethod"] =
    formulaScore >= coverage.score + 0.12 ? "formula" : "semantic";

  return {
    isCorrect: score >= threshold,
    score,
    threshold,
    matchedTerms: coverage.matchedTerms,
    missingTerms: coverage.missingTerms,
    matchMethod,
  };
}

function answersMatchAsText(question: StoredQuestion, submittedValue: string | null | undefined): SubjectiveMatch {
  if (!String(submittedValue ?? "").trim()) {
    return {
      isCorrect: false,
      score: 0,
      threshold: 1,
      matchedTerms: [],
      missingTerms: [],
      matchMethod: "semantic",
    };
  }

  const variants = buildSemanticVariants(question.answerText);
  if (!variants.length) {
    return {
      isCorrect: false,
      score: 0,
      threshold: 1,
      matchedTerms: [],
      missingTerms: [],
      matchMethod: "semantic",
    };
  }

  return variants.reduce<SubjectiveMatch>((best, variant) => {
    const current = evaluateSubjectiveVariant(question, variant, submittedValue);
    if (current.score > best.score) {
      return current;
    }
    return best;
  }, {
    isCorrect: false,
    score: 0,
    threshold: 1,
    matchedTerms: [],
    missingTerms: [],
    matchMethod: "semantic",
  });
}

function normalizeAnswer(payload: QuestionAnswerPayload | PracticeSubmissionPayload): StoredUserAnswer {
  return {
    questionId: String(
      (payload as QuestionAnswerPayload).questionId ??
        (payload as QuestionAnswerPayload).question_id ??
        "",
    ),
    selectedOption:
      payload.selectedOption ??
      payload.selected_option ??
      null,
    selectedOptions:
      payload.selectedOptions ??
      payload.selected_options ??
      null,
    matrixPairs:
      payload.matrixPairs ??
      payload.matrix_pairs ??
      null,
    answerText:
      payload.answerText ??
      payload.answer_text ??
      null,
    timeSpent:
      payload.timeSpent ??
      payload.time_spent ??
      0,
    isMarkedForReview:
      (payload as QuestionAnswerPayload).isMarkedForReview ??
      (payload as QuestionAnswerPayload).is_marked_for_review ??
      false,
  };
}

function hasResponse(answer: StoredUserAnswer): boolean {
  return (
    answer.selectedOption !== null ||
    Boolean(answer.selectedOptions?.length) ||
    Boolean(answer.matrixPairs?.length) ||
    Boolean(answer.answerText?.trim())
  );
}

function gradeAnswer(question: StoredQuestion, answer: StoredUserAnswer): GradeResult {
  if (question.questionType === "mcq") {
    const isCorrect = answer.selectedOption === question.correctOption;
    return {
      isCorrect,
      info: {
        correctOption: question.correctOption,
        correct_option: question.correctOption,
        explanation: question.explanation,
      },
    };
  }

  if (question.questionType === "msq") {
    const submitted = sortedNumbers(answer.selectedOptions);
    const expected = sortedNumbers(question.correctOptions);
    const isCorrect = JSON.stringify(submitted) === JSON.stringify(expected);
    return {
      isCorrect,
      info: {
        correctOptions: question.correctOptions,
        correct_options: question.correctOptions,
        explanation: question.explanation,
      },
    };
  }

  if (question.questionType === "numerical") {
    const submitted = extractNumericValues(answer.answerText)[0];
    const expected = extractNumericValues(question.answerText)[0];
    const tolerance = question.tolerance ?? Math.max(Math.abs(expected ?? 0) * 0.01, 0.001);
    const isCorrect =
      Number.isFinite(submitted) &&
      Number.isFinite(expected) &&
      Math.abs((submitted ?? 0) - (expected ?? 0)) <= tolerance;
    return {
      isCorrect,
      info: {
        correctAnswerText: question.answerText,
        correct_answer_text: question.answerText,
        tolerance: question.tolerance,
        explanation: question.explanation,
      },
    };
  }

  if (question.questionType === "matrix_match") {
    const expected = [...(question.matrixData?.correct_pairs ?? [])]
      .map((pair) => pair.join(":"))
      .sort();
    const submitted = [...(answer.matrixPairs ?? [])]
      .map((pair) => pair.join(":"))
      .sort();
    const isCorrect = JSON.stringify(submitted) === JSON.stringify(expected);
    return {
      isCorrect,
      info: {
        correctPairs: question.matrixData?.correct_pairs ?? [],
        correct_pairs: question.matrixData?.correct_pairs ?? [],
        explanation: question.explanation,
      },
    };
  }

  const semanticMatch = answersMatchAsText(question, answer.answerText);
  const semanticBand = getSemanticBand(semanticMatch.score, semanticMatch.threshold);
  const normalizedSemanticRatio = clamp01(
    semanticMatch.threshold > 0 ? semanticMatch.score / semanticMatch.threshold : semanticMatch.score,
  );
  const creditAwarded = semanticMatch.isCorrect
    ? 1
    : Number(
        (
          semanticBand === "near_match"
            ? normalizedSemanticRatio * 0.4
            : semanticBand === "weak_match"
              ? normalizedSemanticRatio * 0.15
              : 0
        ).toFixed(3),
      );
  return {
    isCorrect: semanticMatch.isCorrect,
    info: {
      correctAnswerText: question.answerText,
      correct_answer_text: question.answerText,
      explanation: question.explanation,
      semanticScore: Number(semanticMatch.score.toFixed(3)),
      semantic_score: Number(semanticMatch.score.toFixed(3)),
      semanticThreshold: Number(semanticMatch.threshold.toFixed(3)),
      semantic_threshold: Number(semanticMatch.threshold.toFixed(3)),
      semanticBand,
      semantic_band: semanticBand,
      creditAwarded,
      credit_awarded: creditAwarded,
      matchMethod: semanticMatch.matchMethod,
      match_method: semanticMatch.matchMethod,
      matchedTerms: semanticMatch.matchedTerms,
      matched_terms: semanticMatch.matchedTerms,
      missingTerms: semanticMatch.missingTerms,
      missing_terms: semanticMatch.missingTerms,
    },
  };
}

async function gradePracticeAnswer(
  question: StoredQuestion,
  answer: StoredUserAnswer,
  userId: string,
): Promise<GradeResult> {
  const remoteGrade = await gradePracticeAnswerWithService(question, answer, userId);
  if (remoteGrade) {
    return remoteGrade;
  }
  return gradeAnswer(question, answer);
}

function questionById(store: AppStore, questionId: string): StoredQuestion {
  const question = store.questions.find((entry) => entry.id === questionId);
  if (!question) {
    throw new Error(`Question ${questionId} was not found.`);
  }
  return question;
}

type ResolvedQuestion = {
  question: StoredQuestion;
  source: "store" | "catalog";
};

async function resolvePracticeQuestion(store: AppStore, questionId: string): Promise<ResolvedQuestion> {
  const fromStore = store.questions.find((entry) => entry.id === questionId);
  if (fromStore) {
    return { question: fromStore, source: "store" };
  }

  const fromCatalog = await getOgcodeCatalogQuestionById(questionId);
  if (fromCatalog) {
    return { question: fromCatalog, source: "catalog" };
  }

  throw new Error(`Question ${questionId} was not found.`);
}

async function getOgcodeQuestionBank(store: AppStore): Promise<StoredQuestion[]> {
  try {
    const catalogQuestions = await listOgcodeCatalogQuestions();
    if (!catalogQuestions.length) {
      return store.questions;
    }

    const questionsById = new Map<string, StoredQuestion>();
    store.questions.forEach((question) => {
      questionsById.set(question.id, question);
    });
    catalogQuestions.forEach((question) => {
      questionsById.set(question.id, question);
    });

    return [...questionsById.values()];
  } catch {
    return store.questions;
  }
}

async function buildQuestionLookup(store: AppStore, questionIds: string[]): Promise<Map<string, StoredQuestion>> {
  const lookup = new Map<string, StoredQuestion>();

  questionIds.forEach((questionId) => {
    const question = store.questions.find((entry) => entry.id === questionId);
    if (question) {
      lookup.set(questionId, question);
    }
  });

  const missingIds = questionIds.filter((questionId) => !lookup.has(questionId));
  if (missingIds.length) {
    const catalogLookup = await getOgcodeCatalogQuestionMap(missingIds);
    catalogLookup.forEach((question, questionId) => {
      lookup.set(questionId, question);
    });
  }

  return lookup;
}

function testById(store: AppStore, testId: string): StoredTest {
  const test = store.tests.find((entry) => entry.id === testId);
  if (!test) {
    throw new Error(`Test ${testId} was not found.`);
  }
  return test;
}

function computeAveragePercentage(results: StoredTestResult[]): number | null {
  if (!results.length) {
    return null;
  }
  const average = results.reduce((sum, result) => sum + result.percentage, 0) / results.length;
  return Math.round(average);
}

export function serializeQuestion(
  store: AppStore,
  userId: string,
  question: StoredQuestion,
  includeCorrectFields = true,
) {
  const attempts = store.practiceAttempts.filter(
    (attempt) => attempt.userId === userId && attempt.questionId === question.id,
  );
  const isSolved = attempts.some((attempt) => attempt.isCorrect);
  const isAttempted = attempts.length > 0;

  const base = {
    id: question.id,
    text: question.text,
    options: question.options ?? undefined,
    correctOption: includeCorrectFields ? question.correctOption : undefined,
    correct_option: includeCorrectFields ? question.correctOption : undefined,
    correctOptions: includeCorrectFields ? question.correctOptions : undefined,
    correct_options: includeCorrectFields ? question.correctOptions : undefined,
    answerText: includeCorrectFields ? question.answerText : undefined,
    answer_text: includeCorrectFields ? question.answerText : undefined,
    matrixData: question.matrixData ?? undefined,
    matrix_data: question.matrixData ?? undefined,
    explanation: question.explanation,
    hint: question.hint ?? undefined,
    subject: question.subject,
    chapter: question.chapter,
    concept: question.concept,
    difficulty: question.difficulty,
    image: question.image ?? undefined,
    tags: question.tags ?? undefined,
    questionType: question.questionType,
    question_type: question.questionType,
    acceptanceRate: Number(question.acceptanceRate.toFixed(1)),
    acceptance_rate: Number(question.acceptanceRate.toFixed(1)),
    totalCorrect: question.totalCorrect,
    total_correct: question.totalCorrect,
    frequency: question.frequency,
    attempted: isAttempted,
    attemptCount: attempts.length,
    attempt_count: attempts.length,
    isSolved: isSolved,
    status: isSolved ? "solved" : isAttempted ? "attempted" : "unattempted",
  };

  return base;
}

export function serializeTest(store: AppStore, userId: string, test: StoredTest) {
  const results = store.testResults
    .filter((result) => result.userId === userId && result.testId === test.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const questions = test.questionIds.map((questionId) =>
    serializeQuestion(store, userId, questionById(store, questionId), true),
  );
  const averageScore = computeAveragePercentage(results);
  const allScores = results.map((result) => result.percentage);

  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter ?? undefined,
    difficulty: test.difficulty,
    duration: test.duration,
    totalQuestions: test.totalQuestions,
    total_questions: test.totalQuestions,
    isPremium: test.isPremium,
    is_premium: test.isPremium,
    questions,
    attempted: results.length > 0,
    score: averageScore,
    attemptCount: results.length,
    attempt_count: results.length,
    allScores,
    all_scores: allScores,
  };
}

export function serializeResult(result: StoredTestResult) {
  return {
    id: result.id,
    testId: result.testId,
    test_id: result.testId,
    score: result.score,
    percentage: result.percentage,
    correctAnswers: result.correctAnswers,
    correct_answers: result.correctAnswers,
    wrongAnswers: result.wrongAnswers,
    wrong_answers: result.wrongAnswers,
    unattempted: result.unattempted,
    timeTaken: result.timeTaken,
    time_taken: result.timeTaken,
    answers: result.answers,
    weakAreas: result.weakAreas,
    weak_areas: result.weakAreas,
    strongAreas: result.strongAreas,
    strong_areas: result.strongAreas,
    aiAnalysis: result.aiAnalysis,
    ai_analysis: result.aiAnalysis,
    subjectStats: result.subjectStats,
    subject_stats: result.subjectStats,
    isMalpractice: result.isMalpractice,
    is_malpractice: result.isMalpractice,
    createdAt: result.createdAt,
    created_at: result.createdAt,
  };
}

async function serializePersistedCustomTest(
  store: AppStore,
  userId: string,
  test: PersistedCustomTestRecord,
) {
  const questionLookup = await buildQuestionLookup(store, test.questionIds);
  const questions = test.questionIds
    .map((questionId) => questionLookup.get(questionId))
    .filter((question): question is StoredQuestion => Boolean(question))
    .map((question) => serializeQuestion(store, userId, question, true));

  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter ?? undefined,
    difficulty: test.difficulty,
    duration: test.durationMinutes,
    totalQuestions: test.questionCount,
    total_questions: test.questionCount,
    isPremium: false,
    is_premium: false,
    questions,
    attempted: test.attemptCount > 0,
    score: test.averageScore,
    attemptCount: test.attemptCount,
    attempt_count: test.attemptCount,
    allScores: test.allScores,
    all_scores: test.allScores,
    focusTopics: test.focusTopics,
    focus_topics: test.focusTopics,
    generationSummary: test.generationSummary,
    generation_summary: test.generationSummary,
    recommendedTimePerQuestionSeconds: test.recommendedTimePerQuestionSeconds,
    recommended_time_per_question_seconds: test.recommendedTimePerQuestionSeconds,
    createdAt: test.createdAt,
    created_at: test.createdAt,
  };
}

function serializePersistedResult(result: PersistedTestResultRecord) {
  return {
    id: result.id,
    testId: result.testId,
    test_id: result.testId,
    score: result.score,
    percentage: result.percentage,
    correctAnswers: result.correctAnswers,
    correct_answers: result.correctAnswers,
    wrongAnswers: result.wrongAnswers,
    wrong_answers: result.wrongAnswers,
    unattempted: result.unattempted,
    timeTaken: result.timeTaken,
    time_taken: result.timeTaken,
    answers: result.answers,
    weakAreas: result.weakAreas,
    weak_areas: result.weakAreas,
    strongAreas: result.strongAreas,
    strong_areas: result.strongAreas,
    aiAnalysis: result.aiAnalysis,
    ai_analysis: result.aiAnalysis,
    subjectStats: result.subjectStats,
    subject_stats: result.subjectStats,
    isMalpractice: result.isMalpractice,
    is_malpractice: result.isMalpractice,
    createdAt: result.createdAt,
    created_at: result.createdAt,
  };
}

async function serializePersistedDppPlan(
  store: AppStore,
  userId: string,
  plan: PersistedDppPlanRecord,
  latestAttempt: PersistedDppAttemptRecord | null,
) {
  const lookup = await buildQuestionLookup(store, plan.questionIds);
  const questions = plan.questionIds
    .map((questionId) => lookup.get(questionId))
    .filter((question): question is StoredQuestion => Boolean(question))
    .map((question) => serializeQuestion(store, userId, question, true));

  return {
    id: plan.id,
    title: plan.title,
    subject: plan.subject,
    summary: plan.summary,
    questions,
    generatedFrom: plan.generatedFrom,
    generated_from: plan.generatedFrom,
    createdAt: plan.createdAt,
    created_at: plan.createdAt,
    completed: plan.completed,
    weakTopics: plan.weakTopics,
    weak_topics: plan.weakTopics,
    duration: plan.durationMinutes,
    duration_minutes: plan.durationMinutes,
    targetQuestionCount: plan.targetQuestionCount,
    target_question_count: plan.targetQuestionCount,
    sequence: plan.sequence,
    latestAttempt: latestAttempt
      ? {
          id: latestAttempt.id,
          summary: latestAttempt.summary,
          recommendations: latestAttempt.recommendations,
          resolvedTopics: latestAttempt.resolvedTopics,
          resolved_topics: latestAttempt.resolvedTopics,
          stillWeakTopics: latestAttempt.stillWeakTopics,
          still_weak_topics: latestAttempt.stillWeakTopics,
          progressScore: latestAttempt.progressScore,
          progress_score: latestAttempt.progressScore,
          completed: latestAttempt.completed,
          createdAt: latestAttempt.createdAt,
          created_at: latestAttempt.createdAt,
        }
      : null,
  };
}

function listTestsFallback(store: AppStore, user: StoredUser) {
  return store.tests.map((test) => serializeTest(store, user.id, test));
}

function getTestDetailFallback(store: AppStore, user: StoredUser, testId: string) {
  return serializeTest(store, user.id, testById(store, testId));
}

function createCustomTestFallback(
  store: AppStore,
  user: StoredUser,
  payload: CustomTestPayload,
) {
  const subject = (payload.subject ?? "mixed").toLowerCase();
  const difficultyValue = (payload.difficulty ?? "medium").toLowerCase();
  const difficulty = difficultyValue === "all" ? null : normalizeDifficulty(difficultyValue);
  const chapter = (payload.chapter ?? "").trim().toLowerCase();
  const questionCount = Math.max(1, Number(payload.question_count ?? 10));

  const candidates = store.questions.filter((question) => {
    const matchesSubject = subject === "all" || subject === "mixed" || question.subject === normalizeSubject(subject);
    const matchesDifficulty = !difficulty || question.difficulty === difficulty;
    const matchesChapter = !chapter || question.chapter.toLowerCase().includes(chapter);
    return matchesSubject && matchesDifficulty && matchesChapter;
  });

  if (!candidates.length) {
    throw new Error("No questions matched that custom test configuration.");
  }

  const selected = candidates.slice(0, Math.min(questionCount, candidates.length));
  const newTest: StoredTest = {
    id: createId("test"),
    title: `${subject === "all" || subject === "mixed" ? "Mixed" : subject[0].toUpperCase() + subject.slice(1)} Custom Test`,
    description: chapter ? `Custom practice set focused on ${chapter}.` : "Custom practice set generated from the question bank.",
    subject: subject === "all" || subject === "mixed" ? "mixed" : normalizeSubject(subject),
    chapter: chapter || null,
    difficulty: difficulty ?? "medium",
    duration: Math.max(10, selected.length * 3),
    totalQuestions: selected.length,
    isPremium: false,
    questionIds: selected.map((question) => question.id),
    createdBy: user.id,
  };

  store.tests.unshift(newTest);
  return serializeTest(store, user.id, newTest);
}

function submitTestFallback(store: AppStore, user: StoredUser, testId: string, payload: TestSubmissionPayload) {
  const test = testById(store, testId);
  const submittedAnswers = payload.answers ?? [];
  const answersMap = new Map<string, StoredUserAnswer>();
  submittedAnswers.forEach((rawAnswer) => {
    const normalized = normalizeAnswer(rawAnswer);
    if (normalized.questionId) {
      answersMap.set(normalized.questionId, normalized);
    }
  });

  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unattempted = 0;
  let score = 0;
  const topicStats: Record<string, { correct: number; total: number }> = {};
  const subjectStats: Record<
    string,
    {
      correct: number;
      incorrect: number;
      unattempted: number;
      total: number;
      timeCorrect: number;
      timeIncorrect: number;
      timeUnattempted: number;
    }
  > = {};
  const userAnswers: StoredUserAnswer[] = [];

  for (const questionId of test.questionIds) {
    const question = questionById(store, questionId);
    const answer = answersMap.get(questionId) ?? {
      questionId,
      selectedOption: null,
      selectedOptions: null,
      matrixPairs: null,
      answerText: null,
      timeSpent: 0,
      isMarkedForReview: false,
    };

    if (!topicStats[question.concept]) {
      topicStats[question.concept] = { correct: 0, total: 0 };
    }
    topicStats[question.concept].total += 1;

    if (!subjectStats[question.subject]) {
      subjectStats[question.subject] = {
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        total: 0,
        timeCorrect: 0,
        timeIncorrect: 0,
        timeUnattempted: 0,
      };
    }
    subjectStats[question.subject].total += 1;

    const { isCorrect } = gradeAnswer(question, answer);
    const answered = hasResponse(answer);

    if (isCorrect) {
      correctAnswers += 1;
      score += 4;
      topicStats[question.concept].correct += 1;
      subjectStats[question.subject].correct += 1;
      subjectStats[question.subject].timeCorrect += answer.timeSpent;
      question.totalCorrect += 1;
    } else if (!answered) {
      unattempted += 1;
      subjectStats[question.subject].unattempted += 1;
      subjectStats[question.subject].timeUnattempted += answer.timeSpent;
    } else {
      wrongAnswers += 1;
      score -= 1;
      subjectStats[question.subject].incorrect += 1;
      subjectStats[question.subject].timeIncorrect += answer.timeSpent;
    }

    question.frequency += 1;
    question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;
    userAnswers.push(answer);
  }

  const totalMarks = test.totalQuestions * 4;
  const percentage = totalMarks > 0 ? Math.max(0, Math.round((score / totalMarks) * 100)) : 0;

  const strongAreas: TopicAccuracy[] = [];
  const weakAreas: TopicAccuracy[] = [];
  Object.entries(topicStats).forEach(([topic, stats]) => {
    const accuracy = Math.round((stats.correct / stats.total) * 100);
    const row = { topic, accuracy };
    if (accuracy > 50) {
      strongAreas.push(row);
    } else {
      weakAreas.push(row);
    }
  });
  strongAreas.sort((left, right) => right.accuracy - left.accuracy);
  weakAreas.sort((left, right) => right.accuracy - left.accuracy);

  const finalSubjectStats: StoredTestResult["subjectStats"] = {};
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    const subScore = stats.correct * 4 - stats.incorrect;
    finalSubjectStats[subject] = {
      score: subScore,
      total_marks: stats.total * 4,
      correct: stats.correct,
      incorrect: stats.incorrect,
      unattempted: stats.unattempted,
      total_qs: stats.total,
      accuracy:
        stats.correct + stats.incorrect > 0
          ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
          : 0,
      time_spent_correct: stats.timeCorrect,
      time_spent_incorrect: stats.timeIncorrect,
      time_spent_unattempted: stats.timeUnattempted,
      total_time_spent: stats.timeCorrect + stats.timeIncorrect + stats.timeUnattempted,
    };
  });

  const reviewEntries: ReviewEntry[] = userAnswers.flatMap((answer) => {
    const question = questionById(store, answer.questionId);
    const grade = gradeAnswer(question, answer);
    if (!hasResponse(answer)) {
      return [];
    }
    return [
      {
        questionId: question.id,
        concept: question.concept,
        status: grade.isCorrect ? ("correct" as const) : ("incorrect" as const),
        error: grade.isCorrect ? "Well Solved / Confirmed" : "Conceptual / Calculation",
        explanation: question.explanation,
        howToApproach: grade.isCorrect
          ? `Keep reinforcing ${question.concept} with one more ${question.difficulty} level problem to lock in the method.`
          : `Review ${question.concept} and repeat ${question.difficulty} level problems.`,
      },
    ];
  });
  const mistakes = reviewEntries
    .filter((entry) => entry.status === "incorrect")
    .map(({ status: _status, ...entry }) => entry);

  const aiSummary =
    correctAnswers > test.totalQuestions / 2
      ? "Good attempt!"
      : "Needs improvement.";

  const result: StoredTestResult = {
    id: createId("result"),
    userId: user.id,
    testId: test.id,
    score,
    percentage,
    correctAnswers,
    wrongAnswers,
    unattempted,
    timeTaken: payload.timeTaken ?? payload.time_taken ?? 0,
    weakAreas,
    strongAreas,
    aiAnalysis: {
      summary:
        weakAreas.length > 0
          ? `${aiSummary} Focus on ${weakAreas.slice(0, 2).map((row) => row.topic).join(", ")}.`
          : aiSummary,
      mistakes,
      reviewEntries,
      recommendations: [
        `Review the ${mistakes.length} answered questions you missed.`,
        "Focus on accuracy before speed.",
        "Repeat one mixed practice set after reviewing the explanations.",
      ],
      dppGenerated: false,
    },
    subjectStats: finalSubjectStats,
    isMalpractice: Boolean(payload.isMalpractice ?? payload.is_malpractice),
    createdAt: new Date().toISOString(),
    answers: userAnswers,
  };

  store.testResults.unshift(result);

  updateUserStreak(store, user.id);
  updateUserStudyTime(user, result.timeTaken);
  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  dailyActivity.questionsPracticed += correctAnswers + wrongAnswers;
  if (score > 0) {
    awardPoints(store, user.id, score, "practice", `Completed test: ${test.title}`, result.id);
  }

  return serializeResult(result);
}

function listTestResultsFallback(store: AppStore, user: StoredUser, testId: string) {
  return store.testResults
    .filter((result) => result.userId === user.id && result.testId === testId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(serializeResult);
}

function getSingleResultFallback(store: AppStore, user: StoredUser, resultId: string) {
  const result = store.testResults.find((entry) => entry.id === resultId && entry.userId === user.id);
  if (!result) {
    throw new Error(`Result ${resultId} was not found.`);
  }
  return serializeResult(result);
}

async function buildAnalyticsAttempts(
  store: AppStore,
  questionIds: string[],
  answersMap: Map<string, StoredUserAnswer>,
) {
  const questionLookup = await buildQuestionLookup(store, questionIds);
  const gradedAttempts: AnalyticsGradedAttempt[] = [];
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unattempted = 0;
  let score = 0;
  const userAnswers: StoredUserAnswer[] = [];
  const subjectStats: Record<
    string,
    {
      correct: number;
      incorrect: number;
      unattempted: number;
      total: number;
      timeCorrect: number;
      timeIncorrect: number;
      timeUnattempted: number;
    }
  > = {};

  for (const questionId of questionIds) {
    const question = questionLookup.get(questionId);
    if (!question) {
      continue;
    }
    const answer = answersMap.get(questionId) ?? {
      questionId,
      selectedOption: null,
      selectedOptions: null,
      matrixPairs: null,
      answerText: null,
      timeSpent: 0,
      isMarkedForReview: false,
    };

    if (!subjectStats[question.subject]) {
      subjectStats[question.subject] = {
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        total: 0,
        timeCorrect: 0,
        timeIncorrect: 0,
        timeUnattempted: 0,
      };
    }

    subjectStats[question.subject].total += 1;
    const answered = hasResponse(answer);
    const { isCorrect } = gradeAnswer(question, answer);

    if (isCorrect) {
      correctAnswers += 1;
      score += 4;
      subjectStats[question.subject].correct += 1;
      subjectStats[question.subject].timeCorrect += answer.timeSpent;
      question.totalCorrect += 1;
    } else if (answered) {
      wrongAnswers += 1;
      score -= 1;
      subjectStats[question.subject].incorrect += 1;
      subjectStats[question.subject].timeIncorrect += answer.timeSpent;
    } else {
      unattempted += 1;
      subjectStats[question.subject].unattempted += 1;
      subjectStats[question.subject].timeUnattempted += answer.timeSpent;
    }

    question.frequency += 1;
    question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;

    gradedAttempts.push({
      question_id: question.id,
      subject: question.subject,
      chapter: question.chapter,
      concept: question.concept,
      difficulty: question.difficulty,
      question_type: question.questionType,
      answered,
      is_correct: isCorrect,
      time_spent_seconds: answer.timeSpent,
    });
    userAnswers.push(answer);
  }

  const finalSubjectStats: StoredTestResult["subjectStats"] = {};
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    const subScore = stats.correct * 4 - stats.incorrect;
    finalSubjectStats[subject] = {
      score: subScore,
      total_marks: stats.total * 4,
      correct: stats.correct,
      incorrect: stats.incorrect,
      unattempted: stats.unattempted,
      total_qs: stats.total,
      accuracy:
        stats.correct + stats.incorrect > 0
          ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
          : 0,
      time_spent_correct: stats.timeCorrect,
      time_spent_incorrect: stats.timeIncorrect,
      time_spent_unattempted: stats.timeUnattempted,
      total_time_spent: stats.timeCorrect + stats.timeIncorrect + stats.timeUnattempted,
    };
  });

  return {
    gradedAttempts,
    correctAnswers,
    wrongAnswers,
    unattempted,
    score,
    subjectStats: finalSubjectStats,
    userAnswers,
    questionLookup,
  };
}

function buildMistakesFromAnswers(
  questionLookup: Map<string, StoredQuestion>,
  answers: StoredUserAnswer[],
) {
  return buildReviewEntriesFromAnswers(questionLookup, answers)
    .filter((entry) => entry.status === "incorrect")
    .map(({ status: _status, ...entry }) => entry);
}

function buildReviewEntriesFromAnswers(
  questionLookup: Map<string, StoredQuestion>,
  answers: StoredUserAnswer[],
): ReviewEntry[] {
  return answers.flatMap((answer) => {
    const question = questionLookup.get(answer.questionId);
    if (!question) {
      return [];
    }
    const grade = gradeAnswer(question, answer);
    if (!hasResponse(answer)) {
      return [];
    }
    return [
      {
        questionId: question.id,
        concept: question.concept,
        status: grade.isCorrect ? ("correct" as const) : ("incorrect" as const),
        error: grade.isCorrect ? "Well Solved / Confirmed" : "Conceptual / Calculation",
        explanation: question.explanation,
        howToApproach: grade.isCorrect
          ? `Keep reinforcing ${question.concept} with one more ${question.difficulty} level problem to lock in the method.`
          : `Review ${question.concept} and repeat ${question.difficulty} level problems.`,
      },
    ];
  });
}

export async function listTests(store: AppStore, user: StoredUser) {
  const seeded = listTestsFallback(store, user);
  try {
    const persisted = await listPersistedCustomTests(user.id);
    const persistedSerialized = await Promise.all(
      persisted.map((test) => serializePersistedCustomTest(store, user.id, test)),
    );
    const deduped = new Map<
      string,
      Awaited<ReturnType<typeof serializePersistedCustomTest>> | ReturnType<typeof serializeTest>
    >();
    for (const test of [...persistedSerialized, ...seeded]) {
      deduped.set(test.id, test);
    }
    return [...deduped.values()];
  } catch {
    return seeded;
  }
}

export async function getTestDetail(store: AppStore, user: StoredUser, testId: string) {
  const seeded = store.tests.find((entry) => entry.id === testId);
  if (seeded) {
    return serializeTest(store, user.id, seeded);
  }

  const persisted = await getPersistedCustomTest(testId, user.id);
  if (!persisted) {
    throw new Error(`Test ${testId} was not found.`);
  }
  return serializePersistedCustomTest(store, user.id, persisted);
}

export async function createCustomTest(
  store: AppStore,
  user: StoredUser,
  payload: CustomTestPayload,
) {
  try {
    const subject = (payload.subject ?? "mixed").toLowerCase();
    const difficultyValue = (payload.difficulty ?? "medium").toLowerCase();
    const difficulty = difficultyValue === "all" ? null : normalizeDifficulty(difficultyValue);
    const generatedId = createId("test");
    const serviceResponse = await generateCustomTestWithService({
      user_id: user.id,
      subject: subject === "all" ? "mixed" : subject,
      difficulty,
      chapter: payload.chapter?.trim() || null,
      question_count: Math.max(1, Number(payload.question_count ?? 10)),
      recent_weak_topics: await getRecentWeakTopicsForUser(user.id),
      attempted_question_ids: await getAttemptedQuestionIdsForUser(user.id),
    });

    if (!serviceResponse) {
      return createCustomTestFallback(store, user, payload);
    }

    await persistGeneratedCustomTest({
      id: generatedId,
      userId: user.id,
      subject: serviceResponse.subject,
      chapter: serviceResponse.chapter ?? null,
      difficulty: serviceResponse.difficulty,
      title: serviceResponse.title,
      description: serviceResponse.description,
      questionIds: serviceResponse.question_ids,
      durationMinutes: serviceResponse.duration_minutes,
      focusTopics: serviceResponse.focus_topics,
      generationSummary: serviceResponse.generation_summary,
      recommendedTimePerQuestionSeconds: serviceResponse.recommended_time_per_question_seconds,
    });

    const latest = await getPersistedCustomTest(generatedId, user.id);
    if (!latest) {
      return createCustomTestFallback(store, user, payload);
    }
    return serializePersistedCustomTest(store, user.id, latest);
  } catch {
    return createCustomTestFallback(store, user, payload);
  }
}

export async function submitTest(store: AppStore, user: StoredUser, testId: string, payload: TestSubmissionPayload) {
  const seededTest = store.tests.find((entry) => entry.id === testId);
  const persistedTest = seededTest ? null : await getPersistedCustomTest(testId, user.id);
  if (!seededTest && !persistedTest) {
    throw new Error(`Test ${testId} was not found.`);
  }

  const submittedAnswers = payload.answers ?? [];
  const answersMap = new Map<string, StoredUserAnswer>();
  submittedAnswers.forEach((rawAnswer) => {
    const normalized = normalizeAnswer(rawAnswer);
    if (normalized.questionId) {
      answersMap.set(normalized.questionId, normalized);
    }
  });

  const title = seededTest?.title ?? persistedTest!.title;
  const subject = seededTest?.subject ?? persistedTest!.subject;
  const chapter = seededTest?.chapter ?? persistedTest!.chapter ?? null;
  const difficulty = seededTest?.difficulty ?? normalizeDifficulty(persistedTest!.difficulty);
  const questionIds = seededTest?.questionIds ?? persistedTest!.questionIds;
  const questionCount = questionIds.length;

  const analytics = await buildAnalyticsAttempts(store, questionIds, answersMap);
  const totalMarks = questionCount * 4;
  const percentage = totalMarks > 0 ? Math.max(0, Math.round((analytics.score / totalMarks) * 100)) : 0;
  const reviewEntries = buildReviewEntriesFromAnswers(analytics.questionLookup, analytics.userAnswers);
  const mistakes = reviewEntries
    .filter((entry) => entry.status === "incorrect")
    .map(({ status: _status, ...entry }) => entry);

  const aiSummary =
    analytics.correctAnswers > questionCount / 2
      ? "Good attempt!"
      : "Needs improvement.";

  try {
    const response = await analyzeSubmittedTestWithService({
      user_id: user.id,
      test_id: testId,
      title,
      subject,
      chapter,
      difficulty,
      question_count: questionCount,
      time_taken_seconds: payload.timeTaken ?? payload.time_taken ?? 0,
      graded_attempts: analytics.gradedAttempts,
    });

    if (!response) {
      return submitTestFallback(store, user, testId, payload);
    }

    const persistedResult = await persistTestAnalysisResult({
      userId: user.id,
      testId,
      title,
      subject,
      chapter,
      difficulty,
      questionCount,
      timeTakenSeconds: payload.timeTaken ?? payload.time_taken ?? 0,
      score: analytics.score,
      percentage,
      correctAnswers: analytics.correctAnswers,
      wrongAnswers: analytics.wrongAnswers,
      unattempted: analytics.unattempted,
      totalMarks,
      subjectStats: analytics.subjectStats,
      answers: analytics.userAnswers,
      weakAreas: response.weak_topics.map((topic) => ({ topic: topic.topic, accuracy: Math.round(topic.accuracy) })),
      strongAreas: response.strong_topics.map((topic) => ({ topic: topic.topic, accuracy: Math.round(topic.accuracy) })),
      aiAnalysis: {
        summary: response.summary || `${aiSummary} Focus on ${response.weak_topics.slice(0, 2).map((row) => row.topic).join(", ")}.`,
        mistakes,
        reviewEntries,
        recommendations: response.recommendations,
        dppGenerated: response.dpp_plans.length > 0,
      },
      recommendations: response.recommendations,
      analyticsContext: response.analytics_context,
      weakTopics: response.weak_topics,
      strongTopics: response.strong_topics,
      dppPlans: response.dpp_plans,
    });

    updateUserStreak(store, user.id);
    updateUserStudyTime(user, payload.timeTaken ?? payload.time_taken ?? 0);
    const dailyActivity = getOrCreateDailyActivity(store, user.id);
    dailyActivity.questionsPracticed += analytics.correctAnswers + analytics.wrongAnswers;
    if (analytics.score > 0) {
      awardPoints(store, user.id, analytics.score, "practice", `Completed test: ${title}`, persistedResult.id);
    }

    return serializePersistedResult(persistedResult);
  } catch {
    return submitTestFallback(store, user, testId, payload);
  }
}

export async function listTestResults(store: AppStore, user: StoredUser, testId: string) {
  try {
    const persisted = await listPersistedTestResults(user.id, testId);
    if (persisted.length > 0) {
      return persisted.map(serializePersistedResult);
    }
  } catch {
    // fall through
  }
  return listTestResultsFallback(store, user, testId);
}

export async function getSingleResult(store: AppStore, user: StoredUser, resultId: string) {
  try {
    const persisted = await getPersistedResultById(user.id, resultId);
    if (persisted) {
      return serializePersistedResult(persisted);
    }
  } catch {
    // fall through
  }
  return getSingleResultFallback(store, user, resultId);
}

export async function listGeneratedDpps(store: AppStore, user: StoredUser) {
  if (!isOgcodePostgresConfigured()) {
    return [];
  }
  const plans = await listPendingDppPlans(user.id);
  const withAttempts = await Promise.all(
    plans.map(async (plan) => serializePersistedDppPlan(store, user.id, plan, await getLatestDppAttemptForPlan(user.id, plan.id))),
  );
  return withAttempts;
}

export async function getGeneratedDppDetail(store: AppStore, user: StoredUser, dppId: string) {
  if (!isOgcodePostgresConfigured()) {
    throw new Error("DPP analytics database is not configured.");
  }
  const plan = await getDppPlanDetail(user.id, dppId);
  if (!plan) {
    throw new Error(`DPP ${dppId} was not found.`);
  }
  const latestAttempt = await getLatestDppAttemptForPlan(user.id, dppId);
  return serializePersistedDppPlan(store, user.id, plan, latestAttempt);
}

export async function submitGeneratedDpp(
  store: AppStore,
  user: StoredUser,
  dppId: string,
  payload: TestSubmissionPayload,
) {
  if (!isOgcodePostgresConfigured()) {
    throw new Error("DPP analytics database is not configured.");
  }
  const plan = await getDppPlanDetail(user.id, dppId);
  if (!plan) {
    throw new Error(`DPP ${dppId} was not found.`);
  }

  const submittedAnswers = payload.answers ?? [];
  const answersMap = new Map<string, StoredUserAnswer>();
  submittedAnswers.forEach((rawAnswer) => {
    const normalized = normalizeAnswer(rawAnswer);
    if (normalized.questionId) {
      answersMap.set(normalized.questionId, normalized);
    }
  });

  const analytics = await buildAnalyticsAttempts(store, plan.questionIds, answersMap);
  const response = await analyzeDppAttemptWithService({
    user_id: user.id,
    dpp_id: dppId,
    title: plan.title,
    source_test_result_id: plan.sourceTestResultId,
    focus_topics: plan.weakTopics,
    graded_attempts: analytics.gradedAttempts,
    time_taken_seconds: payload.timeTaken ?? payload.time_taken ?? 0,
  });

  if (!response) {
    throw new Error("DPP analytics service is unavailable.");
  }

  const persistedAttempt = await persistDppAttemptResult({
    userId: user.id,
    dppId,
    title: plan.title,
    sourceTestResultId: plan.sourceTestResultId,
    focusTopics: plan.weakTopics,
    timeTakenSeconds: payload.timeTaken ?? payload.time_taken ?? 0,
    answers: analytics.userAnswers,
    response,
  });

  updateUserStreak(store, user.id);
  updateUserStudyTime(user, payload.timeTaken ?? payload.time_taken ?? 0);
  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  dailyActivity.questionsPracticed += analytics.correctAnswers + analytics.wrongAnswers;
  if (analytics.score > 0) {
    awardPoints(store, user.id, analytics.score, "dpp", `Completed DPP: ${plan.title}`, persistedAttempt.id);
  }

  return {
    id: persistedAttempt.id,
    dppId: dppId,
    dpp_id: dppId,
    summary: persistedAttempt.summary,
    recommendations: persistedAttempt.recommendations,
    resolvedTopics: persistedAttempt.resolvedTopics,
    resolved_topics: persistedAttempt.resolvedTopics,
    stillWeakTopics: persistedAttempt.stillWeakTopics,
    still_weak_topics: persistedAttempt.stillWeakTopics,
    progressScore: persistedAttempt.progressScore,
    progress_score: persistedAttempt.progressScore,
    completed: persistedAttempt.completed,
    createdAt: persistedAttempt.createdAt,
    created_at: persistedAttempt.createdAt,
    answers: persistedAttempt.answers,
  };
}

export function listPracticeQuestions(
  store: AppStore,
  user: StoredUser,
  filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
) {
  return store.questions
    .filter((question) => {
      const matchesSubject = !filters.subject || question.subject === normalizeSubject(filters.subject);
      const matchesDifficulty = !filters.difficulty || question.difficulty === normalizeDifficulty(filters.difficulty);
      const matchesType = !filters.type || question.questionType === filters.type;
      return matchesSubject && matchesDifficulty && matchesType;
    })
    .map((question) => serializeQuestion(store, user.id, question, true));
}

export async function listOgcodeQuestions(
  store: AppStore,
  user: StoredUser,
  filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
) {
  const questions = await getOgcodeQuestionBank(store);
  return questions
    .filter((question) => {
      const matchesSubject = !filters.subject || question.subject === normalizeSubject(filters.subject);
      const matchesDifficulty = !filters.difficulty || question.difficulty === normalizeDifficulty(filters.difficulty);
      const matchesType = !filters.type || question.questionType === filters.type;
      return matchesSubject && matchesDifficulty && matchesType;
    })
    .map((question) => serializeQuestion(store, user.id, question, false));
}

export async function getPracticeQuestionDetail(store: AppStore, user: StoredUser, questionId: string) {
  const resolved = await resolvePracticeQuestion(store, questionId);
  return serializeQuestion(store, user.id, resolved.question, false);
}

function getOrCreateSubjectRank(store: AppStore, userId: string, subject: string): StoredSubjectRank {
  let entry = store.subjectRanks.find((row) => row.userId === userId && row.subject === subject);
  if (!entry) {
    entry = {
      userId,
      subject,
      questionsSolved: 0,
      rankScore: 0,
      latitude: null,
      longitude: null,
      locationShared: false,
      updatedAt: new Date().toISOString(),
    };
    store.subjectRanks.push(entry);
  }
  return entry;
}

export async function submitPracticeQuestion(
  store: AppStore,
  user: StoredUser,
  questionId: string,
  payload: PracticeSubmissionPayload,
) {
  const resolved = await resolvePracticeQuestion(store, questionId);
  const question = resolved.question;
  const answer = normalizeAnswer(payload);
  answer.questionId = question.id;
  const { isCorrect, info } = await gradePracticeAnswer(question, answer, user.id);

  const attemptedBefore = store.practiceAttempts.some(
    (attempt) => attempt.userId === user.id && attempt.questionId === question.id,
  );
  const solvedBefore = store.practiceAttempts.some(
    (attempt) => attempt.userId === user.id && attempt.questionId === question.id && attempt.isCorrect,
  );
  const practiceScore = calculateTimedPracticeScore(question.difficulty, answer.timeSpent, {
    isCorrect,
    alreadySolved: solvedBefore,
  });

  store.practiceAttempts.unshift({
    id: createId("practice"),
    userId: user.id,
    questionId: question.id,
    isCorrect,
    timeSpent: answer.timeSpent,
    selectedOptions: answer.selectedOptions,
    matrixPairs: answer.matrixPairs,
    answerSubmitted:
      answer.answerText ??
      (answer.selectedOption !== null ? String(answer.selectedOption) : null),
    createdAt: new Date().toISOString(),
  });

  if (resolved.source === "store") {
    question.frequency += 1;
    if (isCorrect) {
      question.totalCorrect += 1;
    }
    question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;
  } else {
    try {
      await incrementOgcodeCatalogQuestionStats(question.id, isCorrect);
    } catch {
      // Keep the attempt flow working even when the catalog DB is temporarily unavailable.
    }
  }

  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  if (!attemptedBefore) {
    dailyActivity.questionsPracticed += 1;
    updateUserStreak(store, user.id);
  }

  if (isCorrect && !solvedBefore) {
    awardPoints(
      store,
      user.id,
      practiceScore.pointsAwarded,
      "practice",
      `Solved ${question.difficulty} ${question.subject} question in ${practiceScore.timeSpentSeconds}s (${practiceScore.speedBand})`,
      question.id,
    );

    const subjectRank = getOrCreateSubjectRank(store, user.id, question.subject);
    subjectRank.questionsSolved += 1;
    subjectRank.rankScore += practiceScore.pointsAwarded;
    subjectRank.updatedAt = new Date().toISOString();
  }

  return {
    isCorrect,
    is_correct: isCorrect,
    already_solved: solvedBefore,
    resultScore: practiceScore.resultScore,
    result_score: practiceScore.resultScore,
    pointsAwarded: practiceScore.pointsAwarded,
    points_awarded: practiceScore.pointsAwarded,
    basePoints: practiceScore.basePoints,
    base_points: practiceScore.basePoints,
    maxPoints: practiceScore.maxPoints,
    max_points: practiceScore.maxPoints,
    timeSpentSeconds: practiceScore.timeSpentSeconds,
    time_spent_seconds: practiceScore.timeSpentSeconds,
    targetTimeSeconds: practiceScore.targetTimeSeconds,
    target_time_seconds: practiceScore.targetTimeSeconds,
    speedMultiplier: practiceScore.speedMultiplier,
    speed_multiplier: practiceScore.speedMultiplier,
    speedBand: practiceScore.speedBand,
    speed_band: practiceScore.speedBand,
    ...info,
  };
}

export async function getOgcodeUserStats(store: AppStore, user: StoredUser) {
  const attempts = store.practiceAttempts.filter((attempt) => attempt.userId === user.id);
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect).length;
  const solvedCount = new Set(
    attempts.filter((attempt) => attempt.isCorrect).map((attempt) => attempt.questionId),
  ).size;
  const attemptedCount = new Set(attempts.map((attempt) => attempt.questionId)).size;
  const totalQuestions = (await getOgcodeQuestionBank(store)).length;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const syllabusCoverage = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 100) : 0;

  const leaderboard = await buildLeaderboardEntries(store, user, null);
  const myRank = leaderboard.find((entry) => entry.isMe)?.rank ?? null;

  return {
    rank: myRank,
    accuracy,
    solvedCount,
    solved_count: solvedCount,
    totalAttempts,
    total_attempts: totalAttempts,
    syllabusCoverage,
    syllabus_coverage: syllabusCoverage,
    streak: user.streak,
  };
}

export function getOgcodeSubjectRanks(store: AppStore, user: StoredUser) {
  const rows = store.subjectRanks
    .filter((entry) => entry.userId === user.id)
    .sort((left, right) => right.rankScore - left.rankScore)
    .map((entry, index) => ({
      subject: entry.subject,
      questionsSolved: entry.questionsSolved,
      questions_solved: entry.questionsSolved,
      rankScore: entry.rankScore,
      rank_score: entry.rankScore,
      rankPosition: index + 1,
      rank_position: index + 1,
    }));

  return rows;
}

async function buildLeaderboardEntries(store: AppStore, user: StoredUser, subject: string | null) {
  const attemptedQuestions = await buildQuestionLookup(
    store,
    store.practiceAttempts.filter((attempt) => attempt.userId === user.id).map((attempt) => attempt.questionId),
  );
  const currentUserAttempts = store.practiceAttempts.filter((attempt) => {
    if (attempt.userId !== user.id || !attempt.isCorrect) {
      return false;
    }
    if (!subject) {
      return true;
    }
    return attemptedQuestions.get(attempt.questionId)?.subject === subject;
  });
  const uniqueSolved = new Set(currentUserAttempts.map((attempt) => attempt.questionId)).size;
  const dailyAnalytics = buildTimeAnalytics(store, user.id);
  const totalMinutes = dailyAnalytics.reduce(
    (sum, row) => sum + row.practiceTime + row.webpageTime + row.pomodoroTime,
    0,
  ) / 60;
  const myRankScore = totalMinutes > 0 ? Number((uniqueSolved / totalMinutes).toFixed(3)) : uniqueSolved * 10;

  const seedEntries = store.leaderboardSeed.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    name: entry.name,
    avatar: entry.avatar,
    rankScore: Number((entry.score / Math.max(entry.studyTime, 1)).toFixed(3)),
    rank_score: Number((entry.score / Math.max(entry.studyTime, 1)).toFixed(3)),
    score: entry.score,
    studyTime: entry.studyTime,
    location: entry.location,
    isMe: false,
    is_me: false,
  }));

  const current = {
    rank: 0,
    userId: user.id,
    name: user.name,
    avatar: user.avatar ?? undefined,
    rankScore: myRankScore,
    rank_score: myRankScore,
    score: buildPointsSummary(store, user.id).totalPoints,
    studyTime: Math.round(totalMinutes),
    location: undefined,
    isMe: true,
    is_me: true,
  };

  const entries = [...seedEntries.filter((entry) => entry.userId !== user.id), current]
    .sort((left, right) => right.rankScore - left.rankScore)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return entries;
}

export async function getOgcodeLeaderboard(store: AppStore, user: StoredUser, subject: string | null) {
  const entries = await buildLeaderboardEntries(store, user, subject);
  return {
    leaderboard: entries.slice(0, 20),
    myRank: entries.find((entry) => entry.isMe)?.rank ?? null,
    my_rank: entries.find((entry) => entry.isMe)?.rank ?? null,
  };
}

export function updateOgcodeLocation(
  store: AppStore,
  user: StoredUser,
  payload: UpdateOgcodeLocationPayload,
) {
  const subject = payload.subject ? normalizeSubject(payload.subject) : "";
  if (!subject) {
    throw new Error("subject is required");
  }
  const entry = getOrCreateSubjectRank(store, user.id, subject);
  if (payload.share && payload.latitude != null && payload.longitude != null) {
    entry.latitude = Number(payload.latitude);
    entry.longitude = Number(payload.longitude);
    entry.locationShared = true;
  } else {
    entry.locationShared = false;
  }
  entry.updatedAt = new Date().toISOString();
  return { status: "updated" };
}

export async function getFocusAreas(store: AppStore, user: StoredUser) {
  const attemptedQuestionIds = new Set<string>();
  store.practiceAttempts
    .filter((attempt) => attempt.userId === user.id)
    .forEach((attempt) => attemptedQuestionIds.add(attempt.questionId));
  store.testResults
    .filter((result) => result.userId === user.id)
    .flatMap((result) => result.answers)
    .forEach((answer) => attemptedQuestionIds.add(answer.questionId));

  const subjects = ["physics", "chemistry", "mathematics", "biology"];
  const questionBank = await getOgcodeQuestionBank(store);
  const attemptedLookup = await buildQuestionLookup(store, [...attemptedQuestionIds]);
  const attemptedBySubject: Record<string, number> = {};
  const totalBySubject = questionBank.reduce<Record<string, number>>((accumulator, question) => {
    accumulator[question.subject] = (accumulator[question.subject] ?? 0) + 1;
    return accumulator;
  }, {});

  attemptedLookup.forEach((question, questionId) => {
    if (attemptedQuestionIds.has(questionId)) {
      attemptedBySubject[question.subject] = (attemptedBySubject[question.subject] ?? 0) + 1;
    }
  });

  return subjects
    .map((subject) => {
      const totalQuestions = totalBySubject[subject] ?? 0;
      const attemptedInSubject = attemptedBySubject[subject] ?? 0;
      const questionsLeft = Math.max(0, totalQuestions - attemptedInSubject);
      const dppsPending = store.dpps.filter(
        (dpp) => dpp.userId === user.id && dpp.subject === subject && !dpp.completed,
      ).length;
      const assignmentsPending = store.assignments.filter(
        (assignment) => assignment.userId === user.id && assignment.subject === subject && !assignment.completed,
      ).length;

      return {
        subject: subject[0].toUpperCase() + subject.slice(1),
        score: questionsLeft + dppsPending * 5 + assignmentsPending * 10,
        questionsLeft,
        questions_left: questionsLeft,
        dppsPending,
        dpps_pending: dppsPending,
        assignmentsPending,
        assignments_pending: assignmentsPending,
        completionRate: totalQuestions > 0 ? Math.round((attemptedInSubject / totalQuestions) * 100) : 100,
        completion_rate: totalQuestions > 0 ? Math.round((attemptedInSubject / totalQuestions) * 100) : 100,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export async function getChallengeOfTheDay(store: AppStore, user: StoredUser) {
  let challenge = null;
  try {
    challenge = await getOgcodeChallengeQuestion();
  } catch {
    challenge = null;
  }
  challenge = challenge ?? store.questions.find((question) => question.isChallengeOfTheDay) ?? store.questions[0];
  if (!challenge) {
    throw new Error("No challenge of the day set.");
  }
  const data = serializeQuestion(store, user.id, challenge, false);
  return {
    ...data,
    isSolved: store.practiceAttempts.some(
      (attempt) => attempt.userId === user.id && attempt.questionId === challenge.id && attempt.isCorrect,
    ),
  };
}
