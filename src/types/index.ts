export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  class?: '9' | '10' | '11' | '12' | 'dropper';
  fieldOfInterest?: string;
  referralSource?: string;
  avatar?: string;
  streak: number;
  totalStudyTime: number;
  joinedAt: Date;
  isPremium: boolean;
  premiumExpiry?: Date;
  isOnboarded: boolean;
  selectedCourse?: string;
  isDropper: boolean;
  // Teacher specific fields
  yearsOfExperience?: string;
  subjects?: string[];
  studentCapacity?: string;
  dailyQuestionsPracticed?: number;
  points?: number; // Added for leaderboard/summary
  timeAnalytics?: Array<{
    date: string;
    dayName: string;
    webpageTime: number;
    practiceTime: number;
    pomodoroTime: number;
  }>;
  contributionData?: Array<{
    date: string;
    count: number;
  }>;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  schedule: string;
  studentCount: number;
  avgAttendance: number;
  students: User[];
}

export interface Test {
  id: string;
  title: string;
  description: string;
  subject: 'physics' | 'chemistry' | 'mathematics' | 'mixed';
  chapter?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: number; // in minutes
  totalQuestions: number;
  questions: Question[];
  isPremium: boolean;
  attempted?: boolean;
  score?: number;
  attemptCount?: number;
  allScores?: number[];
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  explanation: string;
  hint?: string;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'insane';
  image?: string;
  questionType?: 'mcq' | 'subjective' | 'numerical' | 'msq' | 'matrix_match';
  answerText?: string;
  tags?: string[] | string;
  matrixData?: { column_a: string[]; column_b: string[]; correct_pairs: number[][] };
}

export interface PracticeQuestion {
  id: string;
  text: string;
  title?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'insane';
  subject: string;
  concept: string;
  chapter: string;
  isSolved: boolean;
  status?: 'unattempted' | 'solved' | 'attempted';
  questionType: 'mcq' | 'msq' | 'numerical' | 'matrix_match' | 'subjective';
  options?: string[];
  correctOptions?: number[];
  matrixData?: { column_a: string[]; column_b: string[]; correct_pairs: number[][] };
  tags?: string[] | string;
  image?: string;
  tolerance?: number;
  acceptance_rate?: number; // Backend uses snake_case in manual list construction
  frequency?: number;
  hint?: string;
}

export interface SubjectRank {
  subject: string;
  questionsSolved: number;
  totalQuestions?: number;
  rankScore: number;
  rankPosition: number;
  rank?: number;
}
export interface TopicAccuracy {
  topic: string;
  accuracy: number;
}

export interface UserAnswer {
  questionId: string;
  selectedOption: number | null;
  selectedOptions?: number[];
  matrixPairs?: number[][];
  answerText?: string; // Add phase 7 support for non-mcq
  timeSpent: number;
  isMarkedForReview: boolean;
}

export interface TestResult {
  testId: string;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTaken: number;
  answers: UserAnswer[];
  weakAreas: TopicAccuracy[];
  strongAreas: TopicAccuracy[];
  subjectStats?: Record<string, {
    score: number;
    total_marks: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    total_qs: number;
    accuracy: number;
    time_spent_correct: number;
    time_spent_incorrect: number;
    time_spent_unattempted: number;
    total_time_spent: number;
  }>;
  aiAnalysis: AIAnalysis;
  isMalpractice?: boolean;
  percentage?: number;
  createdAt?: string;
}

export interface AIAnalysis {
  summary: string;
  mistakes: MistakeAnalysis[];
  recommendations: string[];
  dppGenerated: boolean;
}

export interface MistakeAnalysis {
  questionId: string;
  concept: string;
  error: string;
  explanation: string;
  howToApproach: string;
}

export interface DPP {
  id: string;
  title: string;
  questions: Question[];
  generatedFrom: string[];
  createdAt: Date;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string;
  metadata?: Record<string, any>;
}

export interface DoubtSession {
  id: string;
  title: string;
  subject?: string;
  activeConcept?: string | null;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PomodoroSession {
  duration: number;
  breakDuration: number;
  isRunning: boolean;
  isBreak: boolean;
  timeRemaining: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date;
  weeklyData: boolean[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  score: number;
  studyTime: number;
  location?: string;
  isLive: boolean;
}

export interface StudyActivity {
  date: Date;
  studyTime: number;
  testsCompleted: number;
  doubtsSolved: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: Date;
}
export interface Task {
  id: number;
  text: string;
  completed: boolean;
  due: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}
export interface BookChapter {
  id: string;
  title: string;
  pages: number;
  pdfFile?: string;
}

export interface Book {
  id: string;
  title: string;
  bookClass: string;
  subject: string;
  coverImage: string;
  chapters: BookChapter[];
  isLiked?: boolean;
  basePath?: string;
}

export interface Note {
  id: string;
  bookId: string;
  chapterId?: string;
  pageNumber?: number;
  content: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface Bookmark {
  id: string;
  bookId: string;
  pageNumber: number;
  title: string;
  createdAt: Date;
}

export interface Highlight {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  color: string;
  rects?: { x: number; y: number; width: number; height: number }[]; // Coordinates if we were doing real PDF rendering
  createdAt: Date;
}

export type ViewState =
  | 'landing'
  | 'role-selection'
  | 'auth'
  | 'onboarding'
  | 'dashboard'
  | 'test-list'
  | 'test-interface'
  | 'test-result'
  | 'dpp'
  | 'doubt-solver'
  | 'leaderboard'
  | 'profile'
  | 'teacher-profile'
  | 'premium'
  | 'ogcode'
  | 'ogcode-workspace'
  | 'pomodoro'
  | 'study-corner'
  | 'explore'
  | 'tasks-goals'
  | 'prestige-milestones';
