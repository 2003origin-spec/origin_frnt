import fs from "node:fs";
import path from "node:path";

import pg from "pg";

const { Client } = pg;

const DEFAULT_FILE = path.resolve(process.cwd(), "data/ogcode/extracted_questions.json");
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
`;

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, dryRun: false, replace: false };

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
    if (value === "--file") {
      args.file = path.resolve(argv[index + 1]);
      index += 1;
    }
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

function buildSeedRows(rawQuestions) {
  const hardQuestionIndex = rawQuestions.findIndex(
    (question) => normalizeDifficulty(question.Difficulty_Level) === "hard",
  );

  return rawQuestions.map((question, index) => {
    const answer = String(question.Answer ?? "").trim();
    const questionType = isNumericalAnswer(answer) ? "numerical" : "subjective";
    const tolerance = questionType === "numerical" ? deriveTolerance(answer) : null;

    return {
      id: `ogcode_pg_${String(index + 1).padStart(4, "0")}`,
      source_index: index + 1,
      text: String(question.Question ?? "").trim(),
      options: null,
      correct_option: null,
      correct_options: null,
      answer_text: answer || null,
      answer_spec: deriveAnswerSpec(answer, questionType, tolerance),
      tolerance,
      matrix_data: null,
      explanation: String(question.Detailed_Explanation ?? "").trim() || "Explanation unavailable.",
      hint: String(question.Hint ?? "").trim() || null,
      subject: "physics",
      chapter: String(question.Chapter ?? "General").trim() || "General",
      concept: String(question.Concept ?? "General Practice").trim() || "General Practice",
      difficulty: normalizeDifficulty(question.Difficulty_Level),
      image: null,
      tags: [
        "physics",
        String(question.Chapter ?? "").trim(),
        String(question.Concept ?? "").trim(),
        normalizeDifficulty(question.Difficulty_Level),
      ].filter(Boolean),
      question_type: questionType,
      acceptance_rate: 0,
      total_correct: 0,
      frequency: 0,
      is_challenge_of_day: index === hardQuestionIndex,
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

function getSslConfig(connectionString) {
  try {
    const url = new URL(connectionString);
    return ["localhost", "127.0.0.1"].includes(url.hostname) ? false : { rejectUnauthorized: false };
  } catch {
    return connectionString.includes("localhost") ? false : { rejectUnauthorized: false };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawFile = fs.readFileSync(args.file, "utf8");
  const parsed = JSON.parse(rawFile);
  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

  if (!rawQuestions.length) {
    throw new Error(`No questions found in ${args.file}`);
  }

  const rows = buildSeedRows(rawQuestions);
  const summary = rows.reduce((accumulator, row) => {
    accumulator[row.difficulty] = (accumulator[row.difficulty] ?? 0) + 1;
    accumulator[row.question_type] = (accumulator[row.question_type] ?? 0) + 1;
    return accumulator;
  }, {});

  console.log(`Prepared ${rows.length} OGCode questions from ${args.file}`);
  console.log(summary);

  if (args.dryRun) {
    return;
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("Set OGCODE_DATABASE_URL, OGCODE_POSTGRES_URL, POSTGRES_URL, or DATABASE_URL before importing OGCode questions.");
  }

  const client = new Client({
    connectionString,
    ssl: getSslConfig(connectionString),
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(CREATE_TABLE_SQL);
    if (args.replace) {
      await client.query("DELETE FROM ogcode_questions");
    }

    for (const row of rows) {
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
            updated_at
          )
          VALUES (
            $1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, $21, $22, $23, NOW()
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
            updated_at = NOW()
        `,
        [
          row.id,
          row.source_index,
          row.text,
          JSON.stringify(row.options),
          row.correct_option,
          JSON.stringify(row.correct_options),
          row.answer_text,
          JSON.stringify(row.answer_spec),
          row.tolerance,
          JSON.stringify(row.matrix_data),
          row.explanation,
          row.hint,
          row.subject,
          row.chapter,
          row.concept,
          row.difficulty,
          row.image,
          JSON.stringify(row.tags),
          row.question_type,
          row.acceptance_rate,
          row.total_correct,
          row.frequency,
          row.is_challenge_of_day,
        ],
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
