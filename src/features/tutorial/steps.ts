
export interface TutorialStep {
  targetId: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'none' | 'click' | 'focus';
}

export const PAGES_STEPS: Record<string, TutorialStep[]> = {
  // Trimmed 12 -> 1 (V1/DESIGN_LANGUAGE.md rule 1).
  //
  // The original twelve steps pointed at targetIds that mostly do not exist on
  // the dashboard — tutorial-nav-ogcode has no element anywhere, and
  // tutorial-test-hub / -dpp-hub / -goals-hub / -mentor live on TestList,
  // DPPView, TasksGoals and OriginAiMentor respectively. With no target to
  // anchor to they all fell back to a centred modal, so the "tour" was twelve
  // full-screen cards narrating UI the student could already see, while
  // covering the greeting and stat cards it was describing.
  //
  // Only tutorial-welcome is genuinely on this screen, so the dashboard gets
  // one short welcome. The real per-feature tips already exist below, anchored
  // to real elements on their own pages — which, with the per-page seen flag in
  // TutorialProvider, is the "one tip on first USE of a feature" the design
  // language asks for.
  dashboard: [
    {
      targetId: 'tutorial-welcome',
      title: 'Welcome to Origin',
      description: 'Have a look around. We\'ll point things out as you go, once each.',
      placement: 'center'
    },
  ],
  'ogcode-workspace': [
    {
      targetId: 'tutorial-ogcode-content',
      title: 'Analyze & Conquer',
      description: 'Read the question carefully. We use scientific formatting to help you visualize complex concepts.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-ogcode-input',
      title: 'Interact',
      description: 'Select your options or enter your numerical answer here. Multiple modes are supported.',
      placement: 'left'
    },
    {
      targetId: 'tutorial-ogcode-submit',
      title: 'Commit Solution',
      description: 'Submit your answer to get instant feedback and points based on your accuracy and speed.',
      placement: 'top'
    },
    {
        targetId: 'tutorial-ogcode-stats',
        title: 'Performance Vitals',
        description: 'Keep an eye on the clock and your earned points. Speed and precision are both rewarded.',
        placement: 'bottom'
    }
  ],
  'ogcode-list': [
    {
      targetId: 'tutorial-ogcode-subject-filter',
      title: 'Subject Intelligence',
      description: 'Select your target subject to refine the arena. We support Physics, Chemistry, Mathematics, and Biology.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-ogcode-difficulty-filter',
      title: 'Intensity Control',
      description: 'Switch between Easy, Medium, Hard, or the elite "Insane" levels to match your preparation depth.',
      placement: 'bottom'
    }
  ],
  'doubt-solver': [
    {
      targetId: 'tutorial-doubt-solver-new',
      title: 'Initiate Discussion',
      description: 'Stuck on a concept or a complex problem? Click here to start a fresh academic dialogue with your personal AI Mentor.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-mentor',
      title: 'AI Mastery',
      description: 'Our AI is trained on vast academic datasets to provide you with step-by-step solutions and conceptual deep-dives.',
      placement: 'left'
    }
  ],
  'test-list': [
    {
      targetId: 'tutorial-test-hub',
      title: 'Exam Simulation',
      description: 'Access nationwide test series. Each test is designed to push your conceptual clarity to the limit.',
      placement: 'bottom'
    }
  ],
  'dpp': [
    {
      targetId: 'tutorial-dpp-hub',
      title: 'Daily Practice Hub',
      description: 'Your personalized batch of challenges. Consistency here is the key to mastering your rank.',
      placement: 'bottom'
    }
  ],
  'tasks-goals': [
    {
      targetId: 'tutorial-goals-hub',
      title: 'Strategic Planning',
      description: 'Manage your academic roadmap. Set milestones and track your progress through each chapter.',
      placement: 'bottom'
    }
  ]
};

// Legacy support if needed, or fallback
export const TUTORIAL_STEPS = PAGES_STEPS.dashboard;

