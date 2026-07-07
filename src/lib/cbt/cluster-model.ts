/**
 * Client-safe CBT cluster model. Kept out of the server service so client
 * components (the Questions bank, the test builder) can import the type without
 * pulling server-only code.
 */

export type CbtCluster = {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
};
