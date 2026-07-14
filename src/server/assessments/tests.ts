export type {
  CustomTestPayload,
  OgcodeAutoSelection,
  QuestionAnswerPayload,
  TestSubmissionPayload,
} from "@/legacy/assessments";

export {
  createCustomTest,
  generateOgcodeSelectionForWorkspace,
  getChallengeOfTheDay,
  getFocusAreas,
  getRoomTestDetail,
  getSingleResult,
  getSingleResultAnalysis,
  getTestDetail,
  listTestPreviews,
  listTestResults,
  listTests,
  serializeQuestion,
  serializeResult,
  serializeTest,
  serializeTestPreview,
  submitTest,
} from "@/legacy/assessments";
