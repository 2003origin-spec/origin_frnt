/**
 * Bug-fix G5: the cheap text pre-check run before a symbolic answer is graded.
 *
 * Mirror of `symbolic_precheck` (and the normalisation in front of it:
 * `normalize_math_text`, `to_comparable_expression`) in
 * grader-service/app/engine.py. The grader also walks the unevaluated sympy
 * tree and runs the comparison in a child process with a timeout; the local
 * fallback has no CAS, so this text check is the whole guard here: an answer
 * that fails it is held for review (0 marks) and never compared at all.
 */

export const MAX_SYMBOLIC_INPUT_CHARS = 200;
const MAX_PAREN_DEPTH = 8;
const MAX_POW_OPERATORS = 6;
const LONG_LITERAL = /\d{13,}/;
const BIG_EXPONENT = /\*\*\s*\(?\s*[+-]?\d{3,}/;
const SAFE_EXPRESSION = /^[0-9a-zA-Z_+\-*/^().=,\s]+$/;

export type SymbolicGuardReason = "input_too_long" | "literal_too_long" | "nesting_too_deep" | "exponent_too_large";

/** Python `symbolic_precheck` on already-normalised text (`^` is `**`); null when it passes. */
export function symbolicPrecheck(text: string): SymbolicGuardReason | null {
  if (text.length > MAX_SYMBOLIC_INPUT_CHARS) return "input_too_long";
  if (LONG_LITERAL.test(text)) return "literal_too_long";
  let depth = 0;
  for (const char of text) {
    if (char === "(") {
      depth += 1;
      if (depth > MAX_PAREN_DEPTH) return "nesting_too_deep";
    } else if (char === ")") {
      depth -= 1;
    }
  }
  if (text.split("**").length - 1 > MAX_POW_OPERATORS || BIG_EXPONENT.test(text)) return "exponent_too_large";
  return null;
}

function replaceUnicodeRoots(value: string): string {
  const out: string[] = [];
  let index = 0;
  while (index < value.length) {
    const char = value[index];
    if (char !== "√") {
      out.push(char);
      index += 1;
      continue;
    }
    index += 1;
    while (index < value.length && /\s/.test(value[index])) index += 1;
    if (index >= value.length) {
      out.push("sqrt");
      break;
    }
    if (value[index] === "(" || value[index] === "{") {
      const opening = value[index];
      const closing = opening === "(" ? ")" : "}";
      let depth = 0;
      const start = index;
      while (index < value.length) {
        if (value[index] === opening) depth += 1;
        else if (value[index] === closing) {
          depth -= 1;
          if (depth === 0) break;
        }
        index += 1;
      }
      if (index < value.length) {
        out.push(`sqrt(${value.slice(start + 1, index)})`);
        index += 1;
        continue;
      }
    }
    const start = index;
    while (index < value.length && /[A-Za-z0-9_.]/.test(value[index])) index += 1;
    const token = value.slice(start, index);
    out.push(token ? `sqrt(${token})` : "sqrt");
  }
  return out.join("");
}

/** Python `normalize_math_text`. */
export function normalizeMathText(value: string | null | undefined): string {
  let text = String(value ?? "").normalize("NFKC");
  text = text.replace(/[−–—]/g, "-");
  text = text.replace(/×/g, "*").replace(/[·⋅]/g, "*").replace(/π/g, "pi");
  text = text.replaceAll("\\left", "").replaceAll("\\right", "");
  text = text.replaceAll("\\times", "*").replaceAll("\\cdot", "*");
  text = text.replaceAll("\\pi", "pi").replaceAll("\\ln", "log");
  text = text.replace(/\\sqrt\s*{([^{}]+)}/g, "sqrt($1)");
  text = text.replace(/\\sqrt\s*\(([^()]+)\)/g, "sqrt($1)");
  text = text.replace(/\\frac\s*{([^{}]+)}\s*{([^{}]+)}/g, "($1)/($2)");
  text = replaceUnicodeRoots(text);
  text = text.replace(/[{[]/g, "(").replace(/[}\]]/g, ")");
  text = text.replaceAll("^", "**");
  return text.replace(/\s+/g, " ").trim();
}

export interface SymbolicSpecLike {
  gradingMode?: string | null;
  targetVariable?: string | null;
  allowRhsOnly?: boolean | null;
}

/** Python `to_comparable_expression`: the text the grader actually hands to sympy. */
function toComparableExpression(raw: string, spec: SymbolicSpecLike): string {
  const normalized = normalizeMathText(raw);
  if ((normalized.match(/=/g) ?? []).length !== 1) return normalized;
  const [leftRaw, rightRaw] = normalized.split("=");
  const left = leftRaw.trim();
  const right = rightRaw.trim();
  if (!left || !right) return normalized;
  const target = (spec.targetVariable ?? "").trim();
  const compact = (text: string) => normalizeMathText(text).replaceAll(" ", "");
  if (spec.allowRhsOnly && (!target || compact(left) === compact(target))) return right;
  if (spec.gradingMode === "equation") return `(${left})-(${right})`;
  return normalized;
}

/**
 * The G5 reason a submitted symbolic answer is refused, or null when it may be
 * compared. Text with notation the grader cannot parse at all (≥, ∫) is left
 * alone: the grader reports that as `parse_error`, not as a guard failure.
 */
export function symbolicGuardReason(raw: string | null | undefined, spec: SymbolicSpecLike): SymbolicGuardReason | null {
  const comparable = toComparableExpression(String(raw ?? ""), spec);
  if (!SAFE_EXPRESSION.test(comparable)) return null;
  return symbolicPrecheck(comparable);
}

const FORMULA_LIKE = /[=\\/^*+-]|√|sqrt|sin|cos|tan|log|ln/;
const TARGET = /^\s*([a-zA-Z]+)\s*=/;

/**
 * The symbolic spec the grader would use for a free-text question (Python
 * `derive_answer_spec`): the authored spec when it is symbolic / equation,
 * else one derived from a formula-like key; null when the question is not
 * graded symbolically.
 */
export function symbolicSpecFor(question: {
  answerText?: string | null;
  answerSpec?: (SymbolicSpecLike & { expectedValue?: string | null }) | null;
}): SymbolicSpecLike | null {
  const spec = question.answerSpec;
  if (spec?.gradingMode) {
    return spec.gradingMode === "symbolic_expression" || spec.gradingMode === "equation" ? spec : null;
  }
  const key = (question.answerText ?? "").trim();
  if (!FORMULA_LIKE.test(key)) return null;
  const target = TARGET.exec(key);
  return target
    ? { gradingMode: "equation", targetVariable: target[1], allowRhsOnly: true }
    : { gradingMode: "symbolic_expression", targetVariable: null, allowRhsOnly: false };
}
