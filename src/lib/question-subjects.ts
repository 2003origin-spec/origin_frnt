// Canonical subjects for teacher-authored questions — a fixed dropdown (never
// free text) so questions group into consistent subject sections in the player.
// "General" is the catch-all for mixed papers.
export const QUESTION_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "General"] as const;
export type QuestionSubject = (typeof QUESTION_SUBJECTS)[number];

/** Questions owned by Origin's own banks (OGCode / platform content, i.e.
 *  ownerScope "platform") are read-only for teachers — they may use them in
 *  tests but not edit them. Teacher-authored questions are ownerScope "workspace". */
export function isOriginBankQuestion(ownerScope: string | null | undefined): boolean {
  return ownerScope === "platform";
}

// Common stored/imported forms → canonical subject. Existing rows and OCR output
// use lowercase or short forms ("general", "maths", "phy"), which a strict
// dropdown can't match — so the subject field would render blank. Map them.
const SUBJECT_ALIASES: Record<string, QuestionSubject> = {
  physics: "Physics", phy: "Physics", phys: "Physics",
  chemistry: "Chemistry", chem: "Chemistry",
  mathematics: "Mathematics", math: "Mathematics", maths: "Mathematics", mat: "Mathematics",
  biology: "Biology", bio: "Biology", bot: "Biology", zoo: "Biology",
  general: "General", gen: "General", mixed: "General", "": "General",
};

/**
 * Map an arbitrary stored subject onto a canonical {@link QUESTION_SUBJECTS}
 * value when possible (case-insensitive + common aliases). Returns `null` when
 * the value can't be recognised, so callers can preserve it as-is rather than
 * silently coercing an unknown subject to "General".
 */
export function canonicalizeSubject(raw: string | null | undefined): QuestionSubject | null {
  const value = (raw ?? "").trim();
  if (!value) return "General";
  const exact = QUESTION_SUBJECTS.find((s) => s.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  return SUBJECT_ALIASES[value.toLowerCase()] ?? null;
}
