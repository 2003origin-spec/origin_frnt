/**
 * Strict number parsing for numerical answers (bug-fix G2).
 *
 * Mirror of `parse_strict_number` in grader-service/app/engine.py — keep the
 * two in lockstep; tests/fixtures/grading-parity.json pins them together.
 *
 * Accepts exactly ONE number, written as:
 *   - a plain decimal: "250", "-1.5", ".5", "−5" (unicode minus)
 *   - a fraction: "3/4"
 *   - scientific notation: "1e-3", "1E-3", "1×10^-3", "1x10^-3", "1*10^-3", "10^3"
 *   - with thousands grouping: "1,000" (Western) or "1,00,000" (Indian)
 *   - with an "Ans:" / "answer =" prefix
 * Whitespace is tolerated only next to an operator ("2.5 e 3"), never between
 * two digits. Anything else — "2 3", "2 or 3", "2,3", "x=2", "5 (approx)",
 * "1/0" — is rejected with `null`: a wrong parse must never become "first
 * number wins".
 */

const NUM = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
const EXP = "[+-]?\\d+";
const GROUPED = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$|^[+-]?\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?$/;
const PLAIN = new RegExp(`^(${NUM})$`);
const FRAC = new RegExp(`^(${NUM})/(${NUM})$`);
const E_FORM = new RegExp(`^(${NUM})[eE](${EXP})$`);
const TIMES_POW = new RegExp(`^(${NUM})[×x*]10\\^\\(?(${EXP})\\)?$`);
const BARE_POW = new RegExp(`^10\\^\\(?(${EXP})\\)?$`);
const ANSWER_PREFIX = /^(?:ans(?:wer)?\s*[:=]\s*)/i;
const OPERATOR_SPACING = /\s*([×x*^/eE(),+\-])\s*/g;
const MAGNITUDE_UNIT = new RegExp(
  `^(${NUM}/${NUM}|10\\^\\(?${EXP}\\)?|[+-]?(?:[\\d,]*\\d(?:\\.\\d*)?|\\.\\d+)(?:[eE]${EXP}|[×x*]10\\^\\(?${EXP}\\)?)?)\\s?(.*)$`,
);

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-",
};
const SUPERSCRIPT_RUN = /[⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;

/**
 * "m²" → "m^2", "s⁻¹" → "s^-1", "10⁻³" → "10^-3", BEFORE NFKC turns "m²" into "m2".
 * Mirror of `superscripts_to_powers` in engine.py.
 */
export function superscriptsToPowers(text: string): string {
  return text.replace(SUPERSCRIPT_RUN, (run) => `^${Array.from(run, (char) => SUPERSCRIPT_DIGITS[char] ?? char).join("")}`);
}

export function compactNumberText(raw: string | null | undefined): string {
  let text = superscriptsToPowers(String(raw ?? "")).normalize("NFKC");
  text = text.replace(/−|–|—/g, "-");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(ANSWER_PREFIX, "");
  return text.replace(OPERATOR_SPACING, "$1");
}

export function parseStrictNumber(raw: string | null | undefined): number | null {
  let text = compactNumberText(raw);
  if (!text) return null;
  if (GROUPED.test(text)) text = text.replace(/,/g, "");
  if (text.includes(",")) return null; // "2,3": ambiguous

  let match = text.match(PLAIN);
  if (match) return finite(Number(match[1]));

  match = text.match(FRAC);
  if (match) {
    const denominator = Number(match[2]);
    if (denominator === 0) return null;
    return finite(Number(match[1]) / denominator);
  }

  // Scientific forms are parsed as ONE literal ("1.5e-3"), never mantissa·10^exp:
  // correctly rounded and identical to Python's float("1.5e-3").
  match = text.match(E_FORM) ?? text.match(TIMES_POW);
  if (match) return finite(Number(`${match[1]}e${match[2]}`));

  match = text.match(BARE_POW);
  if (match) return finite(Number(`1e${match[1]}`));

  return null;
}

/**
 * "9.8 m/s^2" → { magnitude: "9.8", unit: "m/s^2" }; "250" → { magnitude: "250", unit: "" }.
 * `null` when the text does not start with a single strict number.
 */
export function splitMagnitudeAndUnit(raw: string | null | undefined): { magnitude: string; unit: string } | null {
  let text = superscriptsToPowers(String(raw ?? "")).normalize("NFKC");
  text = text.replace(/−|–|—/g, "-");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(ANSWER_PREFIX, "").trim();
  text = text.replace(OPERATOR_SPACING, "$1");
  const match = text.match(MAGNITUDE_UNIT);
  if (!match) return null;
  const unit = (match[2] ?? "").trim();
  if (unit && !/^[a-zA-Z%°µμΩ]/.test(unit)) return null;
  return { magnitude: match[1], unit };
}

// One trailing unit / % / ° after a single number, with no space inside it:
// "30°", "50%", "5 cm", "25 units", "9.8 m/s^2". Digits only as exponents, so
// "2 x 3" (unit "x3") and "2 or 3" (a space) are still rejected.
const UNIT_WORD = "[a-zA-Zµμ°Ω]+(?:\\^\\(?-?[0-9]+\\)?)?";
const SUFFIX_UNIT = new RegExp(`^(?:%|°[a-zA-Z]?|${UNIT_WORD}(?:[/.*]${UNIT_WORD})*)$`);

/**
 * A strict number, or a strict number followed by ONE unit / % / ° suffix (M2).
 * Used when the answer key has no unit: "30°" for key "30" is the number 30.
 * Mirror of `parse_number_ignoring_unit` in grader-service/app/engine.py.
 */
export function parseNumberIgnoringUnit(raw: string | null | undefined): { value: number | null; unitIgnored: boolean } {
  const strict = parseStrictNumber(raw);
  if (strict !== null) return { value: strict, unitIgnored: false };
  const parts = splitMagnitudeAndUnit(raw);
  if (!parts || !parts.unit || !SUFFIX_UNIT.test(parts.unit)) return { value: null, unitIgnored: false };
  const value = parseStrictNumber(parts.magnitude);
  return { value, unitIgnored: value !== null };
}

// A key unit we recognise as a unit (F2): the suffix grammar above, except that a
// unit word may carry a bare digit exponent ("cm²" → NFKC "cm2", "m/s2"). Unit words
// may be joined by "/", ".", "*", a middle dot ("kg·m/s²") or spaces ("m s^-1",
// "N m", "J mol^-1 K^-1"): the dot and the spaces are read as a product. A word
// starting with a digit, or a prose word ("3 or 4", "2 cm or 20 mm", "5 to 6"), is
// not a unit, and an "x"/"×" followed by a digit ("2 x 3" → unit "x3") is a product.
const KEY_UNIT_WORD = "[a-zA-Zµμ°Ω]+(?:\\^?\\(?-?[0-9]+\\)?)?";
const KEY_UNIT = new RegExp(`^(?![xX×]\\^?\\(?-?[0-9])(?:%|°[a-zA-Z]?|${KEY_UNIT_WORD}(?:[/.*]${KEY_UNIT_WORD})*)$`);
const KEY_UNIT_PROSE = new Set(["or", "and", "to", "approx", "approximately", "about", "nearly", "between", "of"]);

/** NFKC, then a middle dot or spaces between unit words become ".". Mirror of `normalize_key_unit` in engine.py. */
export function normalizeKeyUnit(unit: string | null | undefined): string {
  return String(unit ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s*[·⋅]\s*/g, ".")
    .replace(/\s*([/.*])\s*/g, "$1")
    .replace(/\s+/g, ".");
}

/** True when the answer key's suffix reads as a unit. Mirror of `is_recognised_key_unit` in engine.py. */
export function isRecognisedKeyUnit(unit: string | null | undefined): boolean {
  const text = normalizeKeyUnit(unit);
  if (text.split(/[/.*]/).some((word) => KEY_UNIT_PROSE.has(word.toLowerCase()))) return false;
  return KEY_UNIT.test(text);
}

/** True when the key is written as a compact fraction ("2/3", "1.5/4"). Mirror of `fraction_key_text` in engine.py. */
export function isFractionKeyText(text: string | null | undefined): boolean {
  return fractionParts(compactNumberText(text)) !== null;
}

/** Numerator / denominator text of a compact fraction ("3/4"), or null. */
export function fractionParts(text: string): { numerator: string; denominator: string } | null {
  const match = text.match(FRAC);
  return match ? { numerator: match[1], denominator: match[2] } : null;
}

/** Scientific-notation pieces of a compact number text (mantissa, exponent), or null. */
export function scientificParts(text: string): { mantissa: string; exponent: number } | null {
  const match = text.match(E_FORM) ?? text.match(TIMES_POW);
  if (match) return { mantissa: match[1], exponent: Number(match[2]) };
  const bare = text.match(BARE_POW);
  if (bare) return { mantissa: "1", exponent: Number(bare[1]) };
  return null;
}

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}
