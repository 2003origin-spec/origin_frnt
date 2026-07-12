import fs from "node:fs";
import path from "node:path";

import pg from "pg";

const { Client } = pg;

const DEFAULT_BANK_DIR = path.resolve(process.cwd(), "data/ogcode");
const DEFAULT_BANKS = [
  { subject: "physics", code: "phy", file: "extracted_phy_questions.json" },
  { subject: "chemistry", code: "chem", file: "extracted_chem_questions.json" },
  { subject: "mathematics", code: "math", file: "extracted_math_questions.json" },
  { subject: "biology", code: "bio", file: "extracted_bio_questions.json" },
];

const NF_BANK_DIR = path.resolve(process.cwd(), "../../Question-Formats-in-Json");
const NF_BANKS = [
  { subject: "physics",     code: "nf_phy",  file: "Physics_questions.json" },
  { subject: "chemistry",   code: "nf_chem", file: "Chemistry_questions.json" },
  { subject: "mathematics", code: "nf_math", file: "Maths_questions.json" },
  { subject: "biology",     code: "nf_bio",  file: "Biology_questions.json" },
];

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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS ogcode_questions_subject_idx ON ogcode_questions (subject);
  CREATE INDEX IF NOT EXISTS ogcode_questions_difficulty_idx ON ogcode_questions (difficulty);
  CREATE INDEX IF NOT EXISTS ogcode_questions_question_type_idx ON ogcode_questions (question_type);
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS answer_spec JSONB;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS occurrence TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS class INTEGER;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS previous_year_question TEXT;
  CREATE INDEX IF NOT EXISTS ogcode_questions_class_idx ON ogcode_questions (class);
  CREATE INDEX IF NOT EXISTS ogcode_questions_occurrence_idx ON ogcode_questions (occurrence);
`;

function normalizeSubject(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "phy" || normalized === "physics") {
    return "physics";
  }
  if (normalized === "chem" || normalized === "chemistry") {
    return "chemistry";
  }
  if (normalized === "math" || normalized === "maths" || normalized === "mathematics") {
    return "mathematics";
  }
  if (normalized === "bio" || normalized === "biology") {
    return "biology";
  }
  return null;
}

function subjectCodeFromSubject(subject) {
  if (subject === "physics") {
    return "phy";
  }
  if (subject === "chemistry") {
    return "chem";
  }
  if (subject === "mathematics") {
    return "math";
  }
  if (subject === "biology") {
    return "bio";
  }
  return "gen";
}

function deriveSubjectFromFilePath(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("phy") || name.includes("physics")) {
    return "physics";
  }
  if (name.includes("chem") || name.includes("chemistry")) {
    return "chemistry";
  }
  if (name.includes("math")) {
    return "mathematics";
  }
  if (name.includes("bio") || name.includes("biology")) {
    return "biology";
  }
  return null;
}

function parseSubjectFileArg(value) {
  const trimmed = String(value ?? "").trim();
  const separator = trimmed.includes("=") ? "=" : trimmed.includes(":") ? ":" : null;
  if (!separator) {
    throw new Error(`Invalid --subject-file value "${trimmed}". Use subject=path.`);
  }

  const [rawSubject, rawPath] = trimmed.split(separator);
  const subject = normalizeSubject(rawSubject);
  if (!subject) {
    throw new Error(`Unsupported subject "${rawSubject}" in --subject-file argument.`);
  }
  if (!rawPath) {
    throw new Error(`Missing file path in --subject-file value "${trimmed}".`);
  }

  return { subject, code: subjectCodeFromSubject(subject), file: path.resolve(rawPath.trim()) };
}

function parseArgs(argv) {
  const args = { dryRun: false, replace: false, includeNewFormat: false, jsonOut: null, banks: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (value === "--replace") {
      args.replace = true;
      continue;
    }
    if (value === "--include-new-format") {
      args.includeNewFormat = true;
      continue;
    }
    if (value === "--json-out") {
      const outArg = argv[index + 1];
      if (!outArg) throw new Error("Missing value for --json-out.");
      args.jsonOut = path.resolve(outArg);
      index += 1;
      continue;
    }
    if (value === "--subject-file") {
      const subjectFileArg = argv[index + 1];
      if (!subjectFileArg) {
        throw new Error("Missing value for --subject-file.");
      }
      args.banks.push(parseSubjectFileArg(subjectFileArg));
      index += 1;
      continue;
    }
    if (value === "--file") {
      const fileArg = argv[index + 1];
      if (!fileArg) {
        throw new Error("Missing value for --file.");
      }
      const file = path.resolve(fileArg);
      const subject = deriveSubjectFromFilePath(file);
      if (!subject) {
        throw new Error(`Could not derive subject from file "${file}". Use --subject-file subject=path.`);
      }
      args.banks.push({ subject, code: subjectCodeFromSubject(subject), file });
      index += 1;
      continue;
    }
  }

  if (!args.banks.length) {
    args.banks = DEFAULT_BANKS.map((entry) => ({
      subject: entry.subject,
      code: entry.code,
      file: path.join(DEFAULT_BANK_DIR, entry.file),
    }));
  }

  return args;
}

function extractFirstNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  return match ? Number(match[0]) : null;
}

function isNumericalAnswer(answer) {
  return /^[-+]?\d*\.?\d+(?:e[-+]?\d+)?(?:\s*[a-zA-Z%°/^\-]+)?$/.test(
    String(answer ?? "").trim().replace(/,/g, ""),
  );
}

function deriveTolerance(answer) {
  const raw = String(answer ?? "").trim();
  const numeric = extractFirstNumber(raw);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const decimalMatch = raw.match(/\.(\d+)/);
  const decimalTolerance = decimalMatch ? 10 ** -decimalMatch[1].length : 0.01;
  const percentTolerance = Math.abs(numeric) * 0.01;
  return Number(Math.max(decimalTolerance, percentTolerance, 0.001).toFixed(6));
}

function normalizeDifficulty(value) {
  const difficulty = String(value ?? "medium").trim().toLowerCase();
  if (["easy", "medium", "hard", "insane"].includes(difficulty)) {
    return difficulty;
  }
  return "medium";
}

function deriveSymbolAssumptions(answer) {
  const symbols = [...new Set((String(answer ?? "").match(/\b[a-z]\b/g) ?? []).map((entry) => entry.trim()))];
  if (!symbols.length) {
    return null;
  }
  return Object.fromEntries(symbols.map((symbol) => [symbol, "positive"]));
}

function deriveAnswerSpec(answer, questionType, tolerance) {
  const value = String(answer ?? "").trim();
  if (!value) {
    return null;
  }

  if (questionType === "numerical") {
    const unitMatch = value.match(/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*([a-zA-Z%°/^\-]+)$/);
    if (unitMatch?.[1]) {
      return {
        gradingMode: "numerical_with_units",
        expectedValue: value,
        acceptedUnits: [unitMatch[1]],
        tolerance,
        metadata: { source: "ogcode-importer" },
      };
    }

    return {
      gradingMode: "numerical",
      expectedValue: value,
      tolerance,
      metadata: { source: "ogcode-importer" },
    };
  }

  const targetMatch = value.match(/^\s*([a-zA-Z]+)\s*=/);
  const formulaLike = /[=\\/^*+\-]|√|sqrt|sin|cos|tan|log|ln/.test(value);
  if (formulaLike) {
    return {
      gradingMode: targetMatch ? "equation" : "symbolic_expression",
      expectedValue: value,
      acceptedForms: [value],
      targetVariable: targetMatch ? targetMatch[1] : null,
      allowRhsOnly: Boolean(targetMatch),
      tolerance,
      symbolAssumptions: deriveSymbolAssumptions(value),
      metadata: { source: "ogcode-importer" },
    };
  }

  return {
    gradingMode: "subjective_text",
    expectedValue: value,
    metadata: { source: "ogcode-importer" },
  };
}

function normalizeOptionText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\$\$([\s\S]*?)\$\$$/, "$1") // strip $$…$$ display-math wrappers
    .replace(/^\$(.*)\$$/, "$1")            // strip $…$ inline-math wrappers
    .replace(/^[a-d]\s*[).:-]\s*/i, "")
    .replace(/\s+/g, " ");
}

function findCorrectOptionIndex(options, answer) {
  if (!options?.length) {
    return null;
  }

  // Try exact / normalized text match first. Answers in this dataset are values
  // (e.g. "3"), not 1-based option indices, so matching by text is the reliable
  // path and avoids the common failure where a numeric value collides with an
  // index (answer "3" with options ["3","2","4","5"] must resolve to index 0,
  // not index 2).
  const normalizedAnswer = normalizeOptionText(answer);
  if (normalizedAnswer) {
    const matchedIndex = options.findIndex((option) => normalizeOptionText(option) === normalizedAnswer);
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  // Fallback: genuine 1-based option index (e.g. answer is "2" meaning option B)
  // but only when no option text matches.
  const answerNumber = Number(String(answer ?? "").trim());
  if (Number.isInteger(answerNumber) && answerNumber >= 1 && answerNumber <= options.length) {
    return answerNumber - 1;
  }

  return null;
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) {
    return null;
  }
  const normalized = rawOptions.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  return normalized.length ? normalized : null;
}

// ─── Math normalisation helpers ────────────────────────────────────────────────
// Wraps bare LaTeX commands and dimensional-bracket expressions with $ delimiters
// before storing in the DB, so rehype-katex can render them without heuristics.

function consumeBracesAt(text, start) {
  let i = start + 1;
  let depth = 1;
  while (i < text.length && depth > 0) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
    i++;
  }
  return i;
}

// From position `start` (must be `\` beginning a LaTeX command), consume the
// full math chain — commands, brace-groups, scripts, operators, adjacent math.
function consumeLatexChain(text, start) {
  const len = text.length;
  let i = start;
  while (i < len) {
    // LaTeX command \cmd
    if (text[i] === "\\" && i + 1 < len && /[a-zA-Z]/.test(text[i + 1])) {
      i += 2;
      while (i < len && /[a-zA-Z]/.test(text[i])) i++;
      while (i < len && text[i] === "{") i = consumeBracesAt(text, i);
      continue;
    }
    // Brace group {…}
    if (text[i] === "{") { i = consumeBracesAt(text, i); continue; }
    // Superscript / subscript
    if (text[i] === "^" || text[i] === "_") {
      i++;
      if (i < len && text[i] === "{") { i = consumeBracesAt(text, i); continue; }
      if (i < len && /[a-zA-Z0-9\-]/.test(text[i])) { i++; continue; }
      continue;
    }
    // Digits and decimals
    if (/[0-9]/.test(text[i])) {
      while (i < len && /[0-9.,]/.test(text[i])) i++;
      continue;
    }
    // Single variable letter in clear math context
    if (/[a-zA-Z]/.test(text[i])) {
      if (i + 1 < len && /[_^{\\+\-*/=]/.test(text[i + 1])) { i++; continue; }
      if (i > 0 && /[{^_=]/.test(text[i - 1])) { i++; continue; }
      break;
    }
    // Operators: keep going only when followed by more math
    if (/[+\-*/=<>!]/.test(text[i])) {
      const opPos = i;
      i++;
      while (i < len && (text[i] === " " || text[i] === "\t")) i++;
      if (i < len && (text[i] === "\\" || /[0-9(]/.test(text[i]) || text[i] === "{")) continue;
      i = opPos;
      break;
    }
    // Parentheses
    if (text[i] === "(" || text[i] === ")") { i++; continue; }
    // Space: continue only when next non-space is unambiguously math
    if (text[i] === " " || text[i] === "\t") {
      let k = i + 1;
      while (k < len && (text[k] === " " || text[k] === "\t")) k++;
      if (k < len && (
        text[k] === "\\" ||
        /[0-9+\-*/=^_]/.test(text[k]) ||
        (text[k] === "-" && k + 1 < len && /[0-9\\]/.test(text[k + 1]))
      )) { i++; continue; }
      // Single variable letter followed by math operator or script
      if (k < len && /[a-zA-Z]/.test(text[k]) && k + 1 < len && /[_^{\\+\-*/=]/.test(text[k + 1])) {
        i++; continue;
      }
      break;
    }
    break;
  }
  // Trim trailing whitespace and sentence punctuation
  while (i > start && /[\s.,;:!?]/.test(text[i - 1])) i--;
  return i;
}

// Wrap bare LaTeX commands (\cmd…), set-brace notation (\{…\}), and dimensional
// bracket expressions ([M^x L^y T^{-z}]) in $…$ within a plain text segment.
function wrapBareLatexInSegment(text) {
  const out = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    // \{ or \}: set brace notation — scan to matching \}
    if (text[i] === "\\" && i + 1 < len && (text[i + 1] === "{" || text[i + 1] === "}")) {
      const start = i;
      let depth = text[i + 1] === "{" ? 1 : 0;
      i += 2;
      while (i < len && depth > 0) {
        if (text[i] === "\\" && i + 1 < len) {
          if (text[i + 1] === "{") { depth++; i += 2; continue; }
          if (text[i + 1] === "}") { depth--; i += 2; continue; }
          i += 2; continue;
        }
        i++;
      }
      out.push("$" + text.slice(start, i) + "$");
      continue;
    }
    // \command: bare LaTeX command chain
    if (text[i] === "\\" && i + 1 < len && /[a-zA-Z]/.test(text[i + 1])) {
      const start = i;
      i = consumeLatexChain(text, i);
      const math = text.slice(start, i).trim();
      if (math) out.push("$" + math + "$");
      continue;
    }
    // [X^m Y^{-n}]: dimensional bracket notation
    if (text[i] === "[") {
      const closeIdx = text.indexOf("]", i + 1);
      if (closeIdx !== -1 && closeIdx - i <= 80) {
        const inner = text.slice(i + 1, closeIdx);
        if (/[\^_]/.test(inner) || /\\[a-zA-Z]/.test(inner)) {
          let end = closeIdx + 1;
          // Absorb any trailing ^{…} or _{…} after the closing ]
          const scriptRe = /^[_^](?:\{[^}]*\}|[a-zA-Z0-9])/;
          while (end < len) {
            const m = scriptRe.exec(text.slice(end));
            if (!m) break;
            end += m[0].length;
          }
          out.push("$" + text.slice(i, end) + "$");
          i = end;
          continue;
        }
      }
    }
    out.push(text[i]);
    i++;
  }
  return out.join("");
}

// Full normaliser: pass 1 converts explicit \[…\]/\(…\)/√ delimiters;
// pass 2 skips already-wrapped $…$ blocks and wraps bare LaTeX in the rest.
function normalizeMathForStorage(text) {
  if (!text || typeof text !== "string") return text;

  // Pass 1: explicit environment delimiters
  let s = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, b) => `\n$$${b.trim()}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, b) => `$${b.trim()}$`)
    .replace(/√\(([^)\n]+)\)/g, (_, b) => `$\\sqrt{${b}}$`)
    .replace(/√([A-Za-z0-9])/g, (_, c) => `$\\sqrt{${c}}$`);

  // Pass 2: process only plain spans (skip existing $…$ / $$…$$ blocks)
  const out = [];
  let i = 0;
  const len = s.length;
  let plainStart = 0;
  while (i < len) {
    if (s[i] !== "$") { i++; continue; }
    if (i > plainStart) out.push(wrapBareLatexInSegment(s.slice(plainStart, i)));
    if (s[i + 1] === "$") {
      const end = s.indexOf("$$", i + 2);
      if (end !== -1) { out.push(s.slice(i, end + 2)); i = end + 2; plainStart = i; continue; }
    }
    const end = s.indexOf("$", i + 1);
    if (end !== -1) { out.push(s.slice(i, end + 1)); i = end + 1; plainStart = i; continue; }
    i++;
  }
  if (plainStart < len) out.push(wrapBareLatexInSegment(s.slice(plainStart)));
  return out.join("");
}

// Normalise a single MCQ option. If the option is a pure-math expression
// (contains LaTeX commands but no English prose words), the entire option is
// wrapped as one $…$ block so it renders as a single contiguous expression.
// Mixed prose+math options (e.g. "…dimensions [L T^{-1}]") use the segment
// normaliser instead, which only wraps the math fragment.
function normalizeOptionForStorage(option) {
  if (!option || typeof option !== "string") return option;
  const s = option.trim();
  if (!s) return s;

  // Already has $ delimiters — use segment normaliser to avoid double-wrapping
  if (s.includes("$")) return normalizeMathForStorage(s);

  const hasBareLatex = /\\[a-zA-Z{]/.test(s);
  const hasDimBracket = /\[[^\]]*[\^_][^\]]*\]/.test(s);
  if (!hasBareLatex && !hasDimBracket) return s;

  // Strip LaTeX commands + math-only chars; prose words longer than 2 chars remain
  const noLatex = s
    .replace(/\\[a-zA-Z]+(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?(?:[_^](?:\{[^{}]*\}|[a-zA-Z0-9]))?/g, " ")
    .replace(/[0-9+\-*/=<>()[\]^_{},.|!\\]/g, " ");
  const proseWords = noLatex.trim().split(/\s+/).filter((w) => w.length > 2);

  if (proseWords.length === 0) {
    // Pure-math option: wrap the whole thing as one $…$ block
    const pass1 = s
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, b) => b.trim())
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, b) => b.trim())
      .replace(/√\(([^)\n]+)\)/g, (_, b) => `\\sqrt{${b}}`)
      .replace(/√([A-Za-z0-9])/g, (_, c) => `\\sqrt{${c}}`);
    return "$" + pass1 + "$";
  }

  // Mixed: segment-level wrapping
  return normalizeMathForStorage(s);
}
// ─────────────────────────────────────────────────────────────────────────────

function buildSeedRowsForSubject(rawQuestions, subject, subjectCode) {
  const hardQuestionIndex = rawQuestions.findIndex(
    (question) => normalizeDifficulty(question.Difficulty_Level) === "hard",
  );

  return rawQuestions.map((question, index) => {
    const answer = String(question.Answer ?? "").trim();
    // Correct-option matching uses raw option text; stored options are normalised separately.
    const rawOptions = normalizeOptions(question.MCQ_Options);
    const inferredQuestionType = rawOptions?.length ? "mcq" : isNumericalAnswer(answer) ? "numerical" : "subjective";
    const tolerance = inferredQuestionType === "numerical" ? deriveTolerance(answer) : null;
    const correctOption = inferredQuestionType === "mcq" ? findCorrectOptionIndex(rawOptions, answer) : null;
    const options = rawOptions?.map(normalizeOptionForStorage) ?? null;

    return {
      id: `ogcode_${subjectCode}_${String(index + 1).padStart(4, "0")}`,
      source_index: 0,
      text: normalizeMathForStorage(String(question.Question ?? "").trim()),
      options,
      correct_option: correctOption,
      correct_options: null,
      answer_text: normalizeMathForStorage(answer) || null,
      answer_spec: inferredQuestionType === "mcq" ? null : deriveAnswerSpec(answer, inferredQuestionType, tolerance),
      tolerance,
      matrix_data: null,
      explanation: normalizeMathForStorage(String(question.Detailed_Explanation ?? "").trim()) || "Explanation unavailable.",
      hint: normalizeMathForStorage(String(question.Hint ?? "").trim()) || null,
      subject,
      chapter: String(question.Chapter ?? "General").trim() || "General",
      concept: String(question.Concept ?? "General Practice").trim() || "General Practice",
      difficulty: normalizeDifficulty(question.Difficulty_Level),
      image: null,
      tags: [
        subject,
        String(question.Chapter ?? "").trim(),
        String(question.Concept ?? "").trim(),
        normalizeDifficulty(question.Difficulty_Level),
      ].filter(Boolean),
      question_type: inferredQuestionType,
      acceptance_rate: 0,
      total_correct: 0,
      frequency: 0,
      occurrence: null,
      class: null,
      previous_year_question: null,
      _isSubjectChallengeCandidate: index === hardQuestionIndex,
    };
  });
}

function buildSeedRowsForNewFormat(rawQuestions, subject, subjectCode) {
  const LETTER_IDX = { A: 0, B: 1, C: 2, D: 3 };

  return rawQuestions.map((question, index) => {
    // MCQ_Options is an object {A:…, B:…, C:…, D:…} — convert to ordered array
    const optObj = question.MCQ_Options;
    let rawOptions = null;
    if (optObj && typeof optObj === "object" && !Array.isArray(optObj)) {
      const ordered = ["A", "B", "C", "D"]
        .map((k) => optObj[k])
        .filter((v) => v != null && String(v).trim() !== "");
      rawOptions = ordered.length ? ordered : null;
    }
    const options = rawOptions?.map(normalizeOptionForStorage) ?? null;

    // correct_options is a letter array e.g. ["B"] or ["A","C"]
    const correctLetters = Array.isArray(question.correct_options) ? question.correct_options : [];
    const correctIndices = correctLetters
      .map((l) => LETTER_IDX[String(l).trim().toUpperCase()])
      .filter((i) => i !== undefined);

    // For options-less rows, correct_options holds the raw answer value(s)
    // (e.g. ["2500"]), not option letters. Preserve the value into answer_text
    // or the row lands as an ungradeable "numerical" with no answer.
    const rawAnswerValues = correctLetters.map((v) => String(v).trim()).filter(Boolean);

    let questionType;
    if (options?.length) {
      questionType = correctIndices.length > 1 ? "msq" : "mcq";
    } else {
      questionType = rawAnswerValues.length ? "numerical" : "subjective";
    }
    const numericalAnswerText =
      questionType === "numerical" ? normalizeMathForStorage(rawAnswerValues[0]) || null : null;

    const correctOption =
      questionType === "mcq" && correctIndices.length === 1 ? correctIndices[0] : null;
    const correctOptionsArr =
      questionType === "msq" && correctIndices.length > 1 ? correctIndices : null;

    // Occurrence: "NA" → null; keep everything else (JEE, NEET, AIPMT, etc.)
    const rawOcc = String(question.Occurence ?? "").trim();
    const occurrence = !rawOcc || rawOcc === "NA" ? null : rawOcc;

    const pyqRaw = String(question["previous year question"] ?? "").trim().toUpperCase();
    const previousYearQuestion = pyqRaw === "YES" ? "YES" : null;

    const rawImage = String(question["r2 image link"] ?? "").trim();
    const image = rawImage || null;

    const classLevel = Number(question.class) || null;
    const chapter = String(question.TOPIC ?? "General").trim() || "General";
    const concept = String(question["sub topic"] ?? "General Practice").trim() || "General Practice";
    const difficulty = normalizeDifficulty(question["difficulty level"]);
    const text = normalizeMathForStorage(String(question.question ?? "").trim());
    const explanation =
      normalizeMathForStorage(String(question["full detailed solution"] ?? "").trim()) ||
      "Explanation unavailable.";
    const hint = normalizeMathForStorage(String(question["small hint"] ?? "").trim()) || null;

    return {
      id: `ogcode_${subjectCode}_${String(index + 1).padStart(4, "0")}`,
      source_index: 0,
      text,
      options,
      correct_option: correctOption,
      correct_options: correctOptionsArr,
      answer_text: numericalAnswerText,
      answer_spec: null,
      tolerance: null,
      matrix_data: null,
      explanation,
      hint,
      subject,
      chapter,
      concept,
      difficulty,
      image,
      tags: [subject, chapter, concept, difficulty].filter(Boolean),
      question_type: questionType,
      acceptance_rate: 0,
      total_correct: 0,
      frequency: 0,
      occurrence,
      class: classLevel,
      previous_year_question: previousYearQuestion,
      _isSubjectChallengeCandidate: false,
    };
  });
}

function getConnectionString() {
  return (
    process.env.OGCODE_DATABASE_URL ??
    process.env.OGCODE_POSTGRES_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalDatabaseHost(hostname) {
  return LOCAL_DATABASE_HOSTS.has(hostname.replace(/^\[/u, "").replace(/\]$/u, "").toLowerCase());
}

function normalizeConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    if (!isLocalDatabaseHost(url.hostname) && sslMode !== "disable" && sslMode !== "verify-full") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

function getClientConfig(connectionString) {
  const normalizedConnectionString = normalizeConnectionString(connectionString);
  const config = { connectionString: normalizedConnectionString };
  try {
    const url = new URL(normalizedConnectionString);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    if (isLocalDatabaseHost(url.hostname) || sslMode === "disable") {
      config.ssl = false;
    } else if (!sslMode) {
      config.ssl = true;
    }
  } catch {
    config.ssl = connectionString.includes("localhost") ? false : true;
  }
  return config;
}

function loadQuestions(filePath) {
  const rawFile = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(rawFile);
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

function summarizeRows(rows, banks) {
  const summary = rows.reduce(
    (accumulator, row) => {
      accumulator.byDifficulty[row.difficulty] = (accumulator.byDifficulty[row.difficulty] ?? 0) + 1;
      accumulator.byType[row.question_type] = (accumulator.byType[row.question_type] ?? 0) + 1;
      accumulator.bySubject[row.subject] = (accumulator.bySubject[row.subject] ?? 0) + 1;
      if (row.question_type === "mcq") {
        accumulator.mcq.total += 1;
        const key = row.correct_option == null ? "null" : String(row.correct_option);
        accumulator.mcq.correctOptionDistribution[key] = (accumulator.mcq.correctOptionDistribution[key] ?? 0) + 1;
        if (row.correct_option != null) {
          accumulator.mcq.withCorrectOption += 1;
        }
      }
      return accumulator;
    },
    {
      bySubject: {},
      byDifficulty: {},
      byType: {},
      mcq: {
        total: 0,
        withCorrectOption: 0,
        correctOptionDistribution: {},
        firstTwoOptionShare: 0,
      },
    },
  );

  const firstTwoCount =
    (summary.mcq.correctOptionDistribution["0"] ?? 0) +
    (summary.mcq.correctOptionDistribution["1"] ?? 0);
  summary.mcq.firstTwoOptionShare = summary.mcq.withCorrectOption
    ? Number(((firstTwoCount / summary.mcq.withCorrectOption) * 100).toFixed(1))
    : 0;

  return {
    files: banks.map((entry) => ({ subject: entry.subject, file: entry.file })),
    totals: summary,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const rows = [];
  for (const bank of args.banks) {
    const rawQuestions = loadQuestions(bank.file);
    if (!rawQuestions.length) {
      throw new Error(`No questions found in ${bank.file}`);
    }
    rows.push(...buildSeedRowsForSubject(rawQuestions, bank.subject, bank.code));
  }

  if (args.includeNewFormat) {
    for (const bank of NF_BANKS) {
      const filePath = path.join(NF_BANK_DIR, bank.file);
      if (!fs.existsSync(filePath)) {
        console.warn(`Skipping missing new-format file: ${filePath}`);
        continue;
      }
      const rawQuestions = loadQuestions(filePath);
      if (!rawQuestions.length) {
        console.warn(`No questions found in ${filePath}`);
        continue;
      }
      console.log(`Loading new-format bank: ${bank.subject} (${rawQuestions.length} questions)`);
      rows.push(...buildSeedRowsForNewFormat(rawQuestions, bank.subject, bank.code));
    }
  }

  if (!rows.length) {
    throw new Error("No OGCode questions prepared.");
  }

  rows.forEach((row, index) => {
    row.source_index = index + 1;
    row.is_challenge_of_day = false;
  });

  const firstChallenge = rows.find((row) => row._isSubjectChallengeCandidate);
  if (firstChallenge) {
    firstChallenge.is_challenge_of_day = true;
  }

  const summary = summarizeRows(rows, args.banks);
  console.log(`Prepared ${rows.length} OGCode questions from ${args.banks.length} source files`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.totals.mcq.firstTwoOptionShare >= 70) {
    console.warn(
      `Warning: ${summary.totals.mcq.firstTwoOptionShare}% of MCQs with a correct option resolve to A/B. Runtime option shuffling is required.`,
    );
  }

  if (args.jsonOut) {
    // Strip internal-only fields before writing
    const exportRows = rows.map(({ _isSubjectChallengeCandidate, ...rest }) => rest);
    fs.writeFileSync(args.jsonOut, JSON.stringify(exportRows, null, 2), "utf8");
    console.log(`Exported ${exportRows.length} normalised rows → ${args.jsonOut}`);
  }

  if (args.dryRun) {
    return;
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("Set OGCODE_DATABASE_URL, OGCODE_POSTGRES_URL, POSTGRES_URL, or DATABASE_URL before importing OGCode questions.");
  }

  const client = new Client(getClientConfig(connectionString));

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(CREATE_TABLE_SQL);
    if (args.replace) {
      await client.query("DELETE FROM ogcode_questions");
    }

    const batchSize = 250;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      await client.query(
        `
          INSERT INTO ogcode_questions (
            id,
            source_index,
            text,
            options,
            correct_option,
            correct_options,
            answer_text,
            answer_spec,
            tolerance,
            matrix_data,
            explanation,
            hint,
            subject,
            chapter,
            concept,
            difficulty,
            image,
            tags,
            question_type,
            acceptance_rate,
            total_correct,
            frequency,
            is_challenge_of_day,
            occurrence,
            class,
            previous_year_question,
            updated_at
          )
          SELECT
            id,
            source_index,
            text,
            options,
            correct_option,
            correct_options,
            answer_text,
            answer_spec,
            tolerance,
            matrix_data,
            explanation,
            hint,
            subject,
            chapter,
            concept,
            difficulty,
            image,
            tags,
            question_type,
            acceptance_rate,
            total_correct,
            frequency,
            is_challenge_of_day,
            occurrence,
            class,
            previous_year_question,
            NOW()
          FROM jsonb_to_recordset($1::jsonb) AS row(
            id TEXT,
            source_index INTEGER,
            text TEXT,
            options JSONB,
            correct_option INTEGER,
            correct_options JSONB,
            answer_text TEXT,
            answer_spec JSONB,
            tolerance DOUBLE PRECISION,
            matrix_data JSONB,
            explanation TEXT,
            hint TEXT,
            subject TEXT,
            chapter TEXT,
            concept TEXT,
            difficulty TEXT,
            image TEXT,
            tags JSONB,
            question_type TEXT,
            acceptance_rate DOUBLE PRECISION,
            total_correct INTEGER,
            frequency INTEGER,
            is_challenge_of_day BOOLEAN,
            occurrence TEXT,
            class INTEGER,
            previous_year_question TEXT
          )
          ON CONFLICT (id) DO UPDATE SET
            source_index = EXCLUDED.source_index,
            text = EXCLUDED.text,
            options = EXCLUDED.options,
            correct_option = EXCLUDED.correct_option,
            correct_options = EXCLUDED.correct_options,
            answer_text = EXCLUDED.answer_text,
            answer_spec = EXCLUDED.answer_spec,
            tolerance = EXCLUDED.tolerance,
            matrix_data = EXCLUDED.matrix_data,
            explanation = EXCLUDED.explanation,
            hint = EXCLUDED.hint,
            subject = EXCLUDED.subject,
            chapter = EXCLUDED.chapter,
            concept = EXCLUDED.concept,
            difficulty = EXCLUDED.difficulty,
            image = EXCLUDED.image,
            tags = EXCLUDED.tags,
            question_type = EXCLUDED.question_type,
            is_challenge_of_day = EXCLUDED.is_challenge_of_day,
            occurrence = EXCLUDED.occurrence,
            class = EXCLUDED.class,
            previous_year_question = EXCLUDED.previous_year_question,
            updated_at = NOW()
        `,
        [JSON.stringify(batch)],
      );
    }

    await client.query("COMMIT");
    console.log(`Imported ${rows.length} OGCode questions into ogcode_questions.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
