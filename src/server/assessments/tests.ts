export type {
  CustomTestPayload,
  OgcodeAutoSelection,
  QuestionAnswerPayload,
  TeacherTestSitting,
  TestSubmissionPayload,
} from "@/legacy/assessments";

export {
  beginTeacherTestSitting,
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
  openTeacherTestSitting,
  serializeQuestion,
  serializeResult,
  serializeTest,
  serializeTestPreview,
  submitTest,
} from "@/legacy/assessments";
