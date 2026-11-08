/**
 * Numeric tolerance rules for the local grading fallback (bug-fix G1).
 *
 * Mirror of `resolve_tolerance` / `numbers_match` in grader-service/app/engine.py.
 *
 *   - An explicit teacher tolerance (answerSpec.tolerance, else question.tolerance)
 *     is honoured as-is; `0` means exact (it used to be dropped by `||`/`or`).
 *   - No explicit tolerance ⇒ the stated precision of the expected answer rules:
 *     integer-type answers are exact, decimals are exact after rounding the
 *     submitted value to the expected answer's decimal places. A fraction key
 *     ("2/3") states no precision, so the student's typed precision is used (F7).
 *   - Comparisons carry a 1e-9 epsilon for float noise. There is no 1% default.
 */

import {
  compactNumberText,
  isRecognisedKeyUnit,
  normalizeKeyUnit,
  parseNumberIgnoringUnit,
  parseStrictNumber,
  fractionParts,
  isFractionKeyText,
  scientificParts,
  splitMagnitudeAndUnit,
} from "./parse-strict-number";

export type ToleranceKind = "explicit" | "integer_exact" | "decimal_exact";

const GROUPED = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$|^[+-]?\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?$/;

function compactExpected(expectedText: string): string {
  const compact = compactNumberText(expectedText);
  return GROUPED.test(compact) ? compact.replace(/,/g, "") : compact;
}

export function isIntegerText(expectedText: string): boolean {
  return /^[+-]?\d+$/.test(compactExpected(expectedText));
}

function decimalPlacesOfValue(value: number): number {
  const text = String(Math.abs(value));
  if (/[eE]/.test(text)) {
    const [mantissa, exponent] = text.split(/[eE]/);
    const mantissaDp = mantissa.includes(".") ? mantissa.split(".")[1].length : 0;
    return Math.max(0, mantissaDp - Number(exponent));
  }
  return text.includes(".") ? text.split(".")[1].length : 0;
}

/**
 * Decimal places a number was TYPED to; null when the text states none (a fraction).
 * "9.80" → 2, "250" → 0, "1.50e-3" → 5, "1×10^-3" → 3, "10^-2" → 2, "2/3" → null.
 * Mirror of `stated_decimal_places` in grader-service/app/engine.py.
 */
export function statedDecimalPlaces(text: string | null | undefined): number | null {
  const compact = compactExpected(String(text ?? ""));
  const plain = compact.match(/^[+-]?\d*\.(\d*)$/);
  if (plain) return plain[1].length;
  if (/^[+-]?\d+$/.test(compact)) return 0;
  const scientific = scientificParts(compact);
  if (scientific) {
    const mantissaDp = scientific.mantissa.includes(".") ? scientific.mantissa.split(".")[1].length : 0;
    return Math.max(0, mantissaDp - scientific.exponent);
  }
  return null;
}

function decimalToRatio(text: string): { numerator: bigint; scale: number } {
  const unsigned = text.replace(/^[+-]/, "");
  const [intPart, fracPart = ""] = unsigned.split(".");
  return { numerator: BigInt((intPart + fracPart) || "0"), scale: fracPart.length };
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== BigInt(0)) [a, b] = [b, a % b];
  return a;
}

/**
 * Exact decimal places of a fraction with a finite expansion; null otherwise.
 * "1/8" → 3 (0.125), "3/4" → 2, "1.5/4" → 3; "2/3" / "1/7" (repeating) and
 * non-fractions → null. After reducing, the denominator's only prime factors must
 * be 2 and 5. Mirror of `terminating_fraction_places` in engine.py.
 */
export function terminatingFractionPlaces(text: string | null | undefined): number | null {
  const parts = fractionParts(compactExpected(String(text ?? "")));
  if (!parts) return null;
  const top = decimalToRatio(parts.numerator);
  const bottom = decimalToRatio(parts.denominator);
  const ten = BigInt(10);
  // (a / 10^s1) / (b / 10^s2) = (a · 10^s2) / (b · 10^s1)
  const num = top.numerator * ten ** BigInt(bottom.scale);
  let den = bottom.numerator * ten ** BigInt(top.scale);
  if (den === BigInt(0)) return null;
  if (num !== BigInt(0)) den /= gcd(num, den);
  else den = BigInt(1);
  let twos = 0;
  let fives = 0;
  while (den % BigInt(2) === BigInt(0)) {
    den /= BigInt(2);
    twos += 1;
  }
  while (den % BigInt(5) === BigInt(0)) {
    den /= BigInt(5);
    fives += 1;
  }
  return den === BigInt(1) ? Math.max(twos, fives) : null;
}

/** Precision a number states: as typed, or the exact expansion of a terminating fraction. */
export function keyDecimalPlaces(text: string | null | undefined): number | null {
  return statedDecimalPlaces(text) ?? terminatingFractionPlaces(text);
}

/** Decimal places the expected answer was stated to ("9.80" → 2, "1e-3" → 3, "3/4" → 2). */
export function decimalPlacesOf(expectedText: string, expected: number): number {
  return keyDecimalPlaces(expectedText) ?? decimalPlacesOfValue(expected);
}

/** Drop float noise from a scaled / converted value (0.29 * 100 → 29); 12 significant digits. */
function clean(value: number): number {
  return Number.isFinite(value) ? Number(value.toPrecision(12)) : value;
}

/** At least 2 decimals, and at least 2 significant figures of a small key (1/3000). */
function minimumFractionPlaces(expected: number): number {
  if (expected === 0 || !Number.isFinite(expected)) return 2;
  return Math.max(2, 1 - Math.floor(Math.log10(Math.abs(expected))));
}

export function resolveNumericTolerance(
  question: { tolerance: number | null | undefined; answerSpec?: { tolerance?: number | null } | null },
  expectedText: string,
): { tolerance: number; kind: ToleranceKind } {
  const explicit = question.answerSpec?.tolerance ?? question.tolerance;
  if (explicit != null && Number.isFinite(Number(explicit))) {
    return { tolerance: Math.max(0, Number(explicit)), kind: "explicit" };
  }
  return { tolerance: 0, kind: isIntegerText(expectedText) ? "integer_exact" : "decimal_exact" };
}

/** Shortest round-trip decimal digits of |value| without exponent ("1e-7" → "0.0000001"). */
function plainDecimalString(value: number): string {
  const text = String(Math.abs(value));
  if (!/[eE]/.test(text)) return text;
  const [mantissa, exponentText] = text.split(/[eE]/);
  const [intPart, fracPart = ""] = mantissa.split(".");
  const digits = intPart + fracPart;
  const point = intPart.length + Number(exponentText);
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * Half-up (away from zero) on the shortest decimal repr of `value` — mirror of the
 * Python engine's `round_half_up` (Decimal(repr(x)).quantize(ROUND_HALF_UP)).
 * Rounds the digits the student typed, not the binary double: 1.005 → 1.01.
 */
export function roundHalfUp(value: number, decimalPlaces: number): number {
  if (!Number.isFinite(value)) return value;
  const dp = Math.max(0, Math.trunc(decimalPlaces));
  const [intPart, fracPart = ""] = plainDecimalString(value).split(".");
  if (fracPart.length <= dp) return value;
  const kept = BigInt(intPart + fracPart.slice(0, dp)) + BigInt(fracPart[dp] >= "5" ? 1 : 0);
  const keptText = kept.toString().padStart(dp + 1, "0");
  const rounded = dp > 0 ? `${keptText.slice(0, keptText.length - dp)}.${keptText.slice(keptText.length - dp)}` : keptText;
  return (value < 0 ? -1 : 1) * Number(rounded);
}

/**
 * G1 comparison; `submittedText` is the number as the student typed it.
 *
 * decimal_exact with a key that states its precision ("9.8", "1.5e-3") or a
 * terminating fraction ("1/8" = 0.125, exact): the answer is rounded to the key's
 * decimal places, so "0.13" is wrong for 1/8. A repeating fraction key ("2/3") states none, so
 * (F7) the student's own precision is used: the key is rounded to the decimals the
 * student typed (at least 2, and at least 2 significant figures of a small key) and
 * must equal the answer — "0.667" / "0.67" are right for 2/3, "0.7" / "0.666" are not.
 * Mirror of `numbers_match` in grader-service/app/engine.py.
 */
export function numbersMatch(
  expected: number,
  observed: number,
  tolerance: number,
  expectedText: string,
  kind: ToleranceKind,
  submittedText?: string | null,
): boolean {
  if (kind === "decimal_exact") {
    const keyPlaces = keyDecimalPlaces(expectedText);
    if (keyPlaces === null) {
      const studentPlaces =
        (submittedText != null ? statedDecimalPlaces(submittedText) : null) ?? decimalPlacesOfValue(clean(observed));
      const places = Math.max(studentPlaces, minimumFractionPlaces(expected));
      return Math.abs(roundHalfUp(expected, places) - roundHalfUp(observed, places)) <= tolerance + 1e-9;
    }
    return Math.abs(expected - roundHalfUp(observed, keyPlaces)) <= tolerance + 1e-9;
  }
  return Math.abs(expected - observed) <= tolerance + 1e-9;
}

export type NumericGrade = {
  isCorrect: boolean;
  /** Same reason codes as grader-service compare_numeric / compare_quantities. */
  reasonCodes: string[];
  /** Tooling gap (unparseable expected value / unit we cannot convert): no credit, no negative marks. */
  reviewHold: boolean;
  tolerance: number;
  kind: ToleranceKind;
};

function isPercent(unit: string): boolean {
  return unit.normalize("NFKC").trim() === "%";
}

/**
 * Mirror of `normalize_unit_text` in engine.py: a space, "·", "⋅" or "*" between
 * unit words is a product (".") like pint reads it, so "m s^-1" and "m·s^-1" are
 * the same text, and neither is "ms^-1" (per millisecond).
 */
function normalizeUnit(unit: string): string {
  return normalizeKeyUnit(unit).replace(/\*\*/g, "^").replace(/[·⋅*]/g, ".");
}

// Dimension exponents over the SI base units [m, kg, s, A, K, mol, cd].
type Dims = readonly [number, number, number, number, number, number, number];
type UnitValue = { factor: number; dims: Dims };
const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0): Dims => [m, kg, s, A, K, mol, cd];
const JOULE = D(2, 1, -2);
const PASCAL = D(-1, 1, -2);

/**
 * Units the fallback can convert without pint: SI factor + dimension. Common
 * school-physics units and the derived SI units, with pint's factors, so an
 * equal quantity agrees with grader-service `compare_quantities` ("5 cm" =
 * "50 mm", "5 J" = "5 N m" = "5 kg·m²/s²", "5 Ω" = "5 V/A").
 * `prefixable` units also take an SI prefix ("kJ", "mA", "μm", "hPa").
 */
const PREFIXABLE_UNITS: Record<string, UnitValue> = {
  m: { factor: 1, dims: D(1) },
  g: { factor: 1e-3, dims: D(0, 1) },
  s: { factor: 1, dims: D(0, 0, 1) },
  A: { factor: 1, dims: D(0, 0, 0, 1) },
  K: { factor: 1, dims: D(0, 0, 0, 0, 1) },
  mol: { factor: 1, dims: D(0, 0, 0, 0, 0, 1) },
  cd: { factor: 1, dims: D(0, 0, 0, 0, 0, 0, 1) },
  N: { factor: 1, dims: D(1, 1, -2) },
  J: { factor: 1, dims: JOULE },
  W: { factor: 1, dims: D(2, 1, -3) },
  Pa: { factor: 1, dims: PASCAL },
  Hz: { factor: 1, dims: D(0, 0, -1) },
  C: { factor: 1, dims: D(0, 0, 1, 1) },
  V: { factor: 1, dims: D(2, 1, -3, -1) },
  "Ω": { factor: 1, dims: D(2, 1, -3, -2) },
  ohm: { factor: 1, dims: D(2, 1, -3, -2) },
  F: { factor: 1, dims: D(-2, -1, 4, 2) },
  T: { factor: 1, dims: D(0, 1, -2, -1) },
  Wb: { factor: 1, dims: D(2, 1, -2, -1) },
  H: { factor: 1, dims: D(2, 1, -2, -2) },
  S: { factor: 1, dims: D(-2, -1, 3, 2) },
  eV: { factor: 1.602176634e-19, dims: JOULE },
  cal: { factor: 4.184, dims: JOULE },
  Wh: { factor: 3600, dims: JOULE },
  erg: { factor: 1e-7, dims: JOULE },
  dyn: { factor: 1e-5, dims: D(1, 1, -2) },
  L: { factor: 1e-3, dims: D(3) },
  l: { factor: 1e-3, dims: D(3) },
  bar: { factor: 1e5, dims: PASCAL },
};
const PLAIN_UNITS: Record<string, UnitValue> = {
  sec: { factor: 1, dims: D(0, 0, 1) },
  min: { factor: 60, dims: D(0, 0, 1) },
  h: { factor: 3600, dims: D(0, 0, 1) },
  hr: { factor: 3600, dims: D(0, 0, 1) },
  d: { factor: 86400, dims: D(0, 0, 1) },
  day: { factor: 86400, dims: D(0, 0, 1) },
  t: { factor: 1e3, dims: D(0, 1) },
  u: { factor: 1.66053906892e-27, dims: D(0, 1) },
  amu: { factor: 1.66053906892e-27, dims: D(0, 1) },
  "Å": { factor: 1e-10, dims: D(1) },
  angstrom: { factor: 1e-10, dims: D(1) },
  atm: { factor: 101325, dims: PASCAL },
  mmHg: { factor: 133.322387415, dims: PASCAL },
  torr: { factor: 133.32236842105263, dims: PASCAL },
};
const SI_PREFIXES: Record<string, number> = {
  G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1, d: 1e-1, c: 1e-2, m: 1e-3, "μ": 1e-6, u: 1e-6, n: 1e-9, p: 1e-12,
};

function unitAtom(word: string): UnitValue | null {
  const exact = PLAIN_UNITS[word] ?? PREFIXABLE_UNITS[word];
  if (exact) return exact;
  for (const [prefix, scale] of Object.entries(SI_PREFIXES)) {
    const base = word.startsWith(prefix) ? PREFIXABLE_UNITS[word.slice(prefix.length)] : undefined;
    if (base) return { factor: scale * base.factor, dims: base.dims };
  }
  return null;
}

function combine(left: UnitValue, right: UnitValue, sign: 1 | -1): UnitValue {
  return {
    factor: sign === 1 ? left.factor * right.factor : left.factor / right.factor,
    dims: left.dims.map((exponent, index) => exponent + sign * right.dims[index]) as unknown as Dims,
  };
}

function power(value: UnitValue, exponent: number): UnitValue {
  return { factor: value.factor ** exponent, dims: value.dims.map((dim) => dim * exponent) as unknown as Dims };
}

/**
 * Parse `normalizeUnit` text the way pint does: "." is a product, "/" a
 * division (both left to right, same precedence), "^" a power, "( )" groups.
 * null when any word is not a unit we know ("m2", "furlong").
 */
export function parseUnitExpression(unit: string): UnitValue | null {
  const text = normalizeUnit(unit);
  if (!text || text.length > 40) return null;
  let index = 0;
  const factor = (): UnitValue | null => {
    let value: UnitValue | null;
    if (text[index] === "(") {
      index += 1;
      value = expression();
      if (text[index] !== ")") return null;
      index += 1;
    } else {
      const word = /^[a-zA-Zμ\u00c5Ω]+/.exec(text.slice(index));
      if (!word) return null;
      index += word[0].length;
      value = unitAtom(word[0]);
    }
    if (value && text[index] === "^") {
      const exponent = /^\^\(?([+-]?\d+(?:\.\d+)?)\)?/.exec(text.slice(index));
      if (!exponent) return null;
      index += exponent[0].length;
      value = power(value, Number(exponent[1]));
    }
    return value;
  };
  const expression = (): UnitValue | null => {
    let value = factor();
    while (value && (text[index] === "." || text[index] === "/")) {
      const sign = text[index] === "." ? 1 : -1;
      index += 1;
      const next = factor();
      value = next ? combine(value, next, sign) : null;
    }
    return value;
  };
  const value = expression();
  return value && index === text.length ? value : null;
}

function sameDims(left: Dims, right: Dims): boolean {
  return left.every((exponent, index) => Math.abs(exponent - right[index]) < 1e-9);
}

/**
 * Grade one typed numerical answer (G1 + G2) — the TS fallback for grader-service
 * `compare_numeric` (expected has no unit) and `compare_quantities` (it has one).
 *
 * Expected answer WITHOUT a unit (M2): one trailing unit / % / ° on the answer
 * ("30°", "50%", "5 cm") is ignored and the number compared; a "%" answer that
 * does not match is also tried as a fraction ("50%" for key "0.5", F3).
 *
 * For an expected answer with a unit:
 *   - same unit text           ⇒ magnitudes compared with the G1 rules;
 *   - submitted has no unit    ⇒ (M1, default `unitless: "compare_magnitude"`, same
 *     as the grader and contest) the bare number is compared with the expected
 *     magnitude, since phone keypads cannot type units; `"incorrect"` rejects it.
 *     Only when the key's suffix is a unit (F2): "3 or 4" is held / wrong per
 *     `unitMismatch`. A "%" key also accepts the fraction ("0.5" for "50 %", F3);
 *   - both units parse (`parseUnitExpression`) ⇒ converted and compared like pint does; a
 *     different dimension ("5 m" vs "5 kg") is wrong (`dimension_mismatch`);
 *   - anything else (a key unit pint cannot read, a unit outside the table)
 *     ⇒ `unitMismatch: "review"` holds it for a human at 0 (as the grader holds
 *     an unreadable key unit), `"incorrect"` marks it wrong.
 */
export function gradeNumericText(input: {
  expectedText: string | null | undefined;
  submittedText: string | null | undefined;
  question: { tolerance: number | null | undefined; answerSpec?: { tolerance?: number | null } | null };
  unitless?: "incorrect" | "compare_magnitude";
  unitMismatch?: "review" | "incorrect";
}): NumericGrade {
  const expectedParts = splitMagnitudeAndUnit(input.expectedText);
  const expectedMagnitude = expectedParts ? parseStrictNumber(expectedParts.magnitude) : null;
  const expectedText = expectedParts?.magnitude ?? String(input.expectedText ?? "");
  const { tolerance, kind } = resolveNumericTolerance(input.question, expectedText);
  const base = { tolerance, kind };
  if (!expectedParts || expectedMagnitude === null) {
    return { ...base, isCorrect: false, reasonCodes: ["expected_not_numeric"], reviewHold: true };
  }
  const compare = (observed: number, codes: string[], observedText?: string | null): NumericGrade => ({
    ...base,
    isCorrect: numbersMatch(expectedMagnitude, observed, tolerance, expectedText, kind, observedText),
    reasonCodes: [...codes, `tolerance_${kind}`],
    reviewHold: false,
  });

  if (!expectedParts.unit) {
    const { value: observed, unitIgnored } = parseNumberIgnoringUnit(input.submittedText);
    if (observed === null) return { ...base, isCorrect: false, reasonCodes: ["numeric_parse_error"], reviewHold: false };
    const parts = unitIgnored ? splitMagnitudeAndUnit(input.submittedText) : null;
    const codes = unitIgnored ? ["numeric_compare", "unit_ignored"] : ["numeric_compare"];
    // F3: a percentage answer to a unitless key ("0.5" ← "50%") is converted FIRST.
    // A fraction key ("2/3") is a ratio, never a percentage, so its "%" answer is only
    // converted: "0.67%" is 0.0067, not 2/3 (R3-9). Any other key still accepts the
    // number with the sign ignored (M2: "50%" for key "50").
    if (parts && isPercent(parts.unit)) {
      const converted = compare(clean(observed / 100), [...codes, "percent_converted"]);
      if (converted.isCorrect) return converted;
      if (isFractionKeyText(input.expectedText)) return { ...converted, isCorrect: false, reasonCodes: [...codes, `tolerance_${kind}`] };
    }
    return compare(observed, codes, parts ? parts.magnitude : input.submittedText);
  }

  const submittedParts = splitMagnitudeAndUnit(input.submittedText);
  const observed = submittedParts ? parseStrictNumber(submittedParts.magnitude) : null;
  if (!submittedParts || observed === null) {
    return { ...base, isCorrect: false, reasonCodes: ["unit_parse_error"], reviewHold: false };
  }
  if (!submittedParts.unit) {
    if ((input.unitless ?? "compare_magnitude") !== "compare_magnitude") {
      return { ...base, isCorrect: false, reasonCodes: ["dimension_mismatch"], reviewHold: false };
    }
    // F2: only when the key's suffix is a unit. "3 or 4" / "2 cm or 20 mm" are
    // alternatives, not "3 <unit>": held for a human (wrong in contests).
    if (!isRecognisedKeyUnit(expectedParts.unit)) {
      return (input.unitMismatch ?? "review") === "review"
        ? { ...base, isCorrect: false, reasonCodes: ["expected_unit_parse_error"], reviewHold: true }
        : { ...base, isCorrect: false, reasonCodes: ["unit_mismatch"], reviewHold: false };
    }
    const grade = compare(observed, ["unit_compare", "unitless_magnitude"], submittedParts.magnitude);
    // F3: a percentage key also accepts the fraction ("50 %" ← "0.5").
    if (!grade.isCorrect && isPercent(expectedParts.unit)) {
      const converted = compare(clean(observed * 100), ["unit_compare", "unitless_magnitude", "percent_converted"]);
      if (converted.isCorrect) return converted;
    }
    return grade;
  }
  if (normalizeUnit(submittedParts.unit) === normalizeUnit(expectedParts.unit)) {
    return compare(observed, ["unit_compare"], submittedParts.magnitude);
  }
  const expectedUnit = parseUnitExpression(expectedParts.unit);
  const submittedUnit = parseUnitExpression(submittedParts.unit);
  if (expectedUnit && submittedUnit) {
    if (!sameDims(expectedUnit.dims, submittedUnit.dims)) {
      return { ...base, isCorrect: false, reasonCodes: ["dimension_mismatch"], reviewHold: false };
    }
    return compare(observed * (submittedUnit.factor / expectedUnit.factor), ["unit_compare"]);
  }
  return (input.unitMismatch ?? "review") === "review"
    ? { ...base, isCorrect: false, reasonCodes: ["unit_conversion_unavailable"], reviewHold: true }
    : { ...base, isCorrect: false, reasonCodes: ["unit_mismatch"], reviewHold: false };
}
