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
