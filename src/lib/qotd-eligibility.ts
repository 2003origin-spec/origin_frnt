/**
 * Which question CLASSES a student may be dealt for the Question of the Day.
 *
 * OG Code's bank is entirely class 11-12 today (6 232 rows, zero outside 11/12,
 * zero NULL). The product intent is that QOTD reaches senior-secondary students
 * only — but hard-coding "11 and 12" would have to be unpicked the moment 9-10
 * content lands. So the rule is expressed as a BAND, a named group of classes:
 *
 *     student class                →  band     →  question classes
 *     11 / 12 / dropper / unknown  →  senior   →  [11, 12]
 *     9 / 10                       →  junior   →  [9, 10]
 *
 * A class-9 student therefore resolves to a band that currently matches no rows,
 * so their bag is empty and no card is shown — the required gate falls out of
 * the data rather than out of a special case. When 9-10 questions are imported
 * the same code starts drawing four more bags, with no change here and no
 * conflict with the senior band.
 *
 * Droppers sit in the senior band: they are JEE/NEET repeaters working the 11-12
 * syllabus.
 *
 * UNKNOWN maps to the senior band on purpose. `origin_users.student_class` is
 * nullable and frequently unset (every seeded local student has it NULL), and
 * every student on an 11-12-only product is a senior-band student. Defaulting
 * the other way would silently blank the feature for most of the live base.
 *
 * The band is a STRING, and the classes are derived from it — never the other
 * way round. Deriving a band by comparing class arrays would make an inline
 * `[9, 10]` silently read as "senior", and the band is a storage key
 * (`ogcode_daily_subject_questions.class_band`), so that mislabel would put
 * junior draws in the senior bag.
 */

/** A named group of classes. One bag is drawn per (band, subject) per day. */
export type ClassBand = "senior" | "junior";

/** Every band, in the order bags are drawn. */
export const ALL_CLASS_BANDS: readonly ClassBand[] = ["senior", "junior"];

/** The question classes each band covers. */
const BAND_CLASSES: Record<ClassBand, readonly number[]> = {
  senior: [11, 12],
  junior: [9, 10],
};

/** The classes a band covers. */
export function bandClasses(band: ClassBand): readonly number[] {
  return BAND_CLASSES[band];
}

/**
 * The band `studentClass` belongs to.
 *
 * Accepts whatever `origin_users.student_class` holds — it is free TEXT, written
 * from signup and profile edits, so "11", " 12 ", "Dropper" and null all occur.
 */
export function eligibleClassBand(studentClass: string | null | undefined): ClassBand {
  const normalized = String(studentClass ?? "").trim().toLowerCase();
  return normalized === "9" || normalized === "10" ? "junior" : "senior";
}

/** The question classes `studentClass` may be dealt from. */
export function eligibleQuestionClasses(
  studentClass: string | null | undefined,
): readonly number[] {
  return bandClasses(eligibleClassBand(studentClass));
}

/**
 * Whether rows with `class IS NULL` belong to this band.
 *
 * True only for the senior band: any untagged row in today's bank is 11-12
 * content, so dropping it would shrink the senior bag for no reason. Letting
 * those rows into the junior band, by contrast, would hand a class-9 student
 * class-11 physics — the exact conflict this mapping exists to prevent.
 */
export function bandIncludesUnclassified(band: ClassBand): boolean {
  return band === "senior";
}
