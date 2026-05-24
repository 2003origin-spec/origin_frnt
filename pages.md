# ORIGIN Teacher Platform Screen Directory & Component Specification

This document maps all the pages to be generated for the ORIGIN Teacher Platform. It lists their Next.js routes, structural components, and responsive behaviors (Desktop, Tablet, Mobile) to ensure a smooth design process in Stitch.

---

## 1. Page List & Checklists

- [x] **Page 1: Home Dashboard** (`/teacher/workspaces/[workspaceId]`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen c6eb1e95e0f5472288f5daa3ef0da7fa)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/c6eb1e95e0f5472288f5daa3ef0da7fa)
    - [Tablet (Screen 7b2610f929664eeabf1af87cec4ad80a)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/7b2610f929664eeabf1af87cec4ad80a)
    - [Mobile (Screen 186ab11fa5c94d838a1f85bf0ad7fca6)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/186ab11fa5c94d838a1f85bf0ad7fca6)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 145dc19599404676b2ed2a42fc4000f1)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/145dc19599404676b2ed2a42fc4000f1)
    - [Tablet (Screen 47f0230a620246aa98ca9970a34e3a69)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/47f0230a620246aa98ca9970a34e3a69)
    - [Mobile (Screen a4ac34be6d954a6e8932d1c3ccfc7ad1)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a4ac34be6d954a6e8932d1c3ccfc7ad1)
- [x] **Page 2: Students Directory & Onboarding Queue** (`/teacher/workspaces/[workspaceId]/students`) - [Stitch Screen 7635c5366f174d8c960de531753f155d](https://stitch.withgoogle.com/projects/2531893112967424418/screens/7635c5366f174d8c960de531753f155d)
- [x] **Page 3: Batch Details & Syllabus Planner** (`/teacher/workspaces/[workspaceId]/batches/[batchId]`) - [Stitch Screen 724a5abfda3242f08b0b129d08f26eba](https://stitch.withgoogle.com/projects/2531893112967424418/screens/724a5abfda3242f08b0b129d08f26eba)
- [x] **Page 4: Question Bag Library & Manual Editor** (`/teacher/workspaces/[workspaceId]/question-bag`) - [Stitch Screen 3c190e3c21e84c8ea0ad1fdb2e1608cb](https://stitch.withgoogle.com/projects/2531893112967424418/screens/3c190e3c21e84c8ea0ad1fdb2e1608cb)
- [x] **Page 5: Document Import Pipeline & Review Panel** (`/teacher/workspaces/[workspaceId]/question-bag/import`) - [Stitch Screen 13d6001439274de5acc131c5425ddf74](https://stitch.withgoogle.com/projects/2531893112967424418/screens/13d6001439274de5acc131c5425ddf74)
- [x] **Page 6: Scheduled Test Creator & Builder** (`/teacher/workspaces/[workspaceId]/tests`) - [Stitch Screen 5f83d43051294e208d9485116119842b](https://stitch.withgoogle.com/projects/2531893112967424418/screens/5f83d43051294e208d9485116119842b)
- [x] **Page 7: Live Study Room Real-Time Dashboard** (`/teacher/workspaces/[workspaceId]/rooms/[roomId]`) - [Stitch Screen a71a524021dd49ad87478dc979ea5787](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a71a524021dd49ad87478dc979ea5787)
- [x] **Page 8: Analytics Center & Weakness Remediation** (`/teacher/workspaces/[workspaceId]/analytics`) - [Stitch Screen 9e9ba6c9211a412fb84a3d853ae752aa](https://stitch.withgoogle.com/projects/2531893112967424418/screens/9e9ba6c9211a412fb84a3d853ae752aa)
- [x] **Page 9: OGCode Contributor & Workspace Settings** (`/teacher/workspaces/[workspaceId]/settings`) - [Stitch Screen 6f6c7441f35c4ed3a85e38fd0be63920](https://stitch.withgoogle.com/projects/2531893112967424418/screens/6f6c7441f35c4ed3a85e38fd0be63920)

---

## 2. Structural Specs by Page

### Page 1: Home Dashboard
**Route:** `/teacher/workspaces/[workspaceId]`  
*Focus:* Active class telemetries and immediate task list.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header (56px) + Main content area in a 3-column card grid.
    *   **Tablet:** Sticky Top Navigation Header (56px) + Main content area in 2 columns (Alerts/Hero spans full-width, Timeline and Schedule stacked).
    *   **Mobile:** Bottom Glassmorphic Floating Nav Dock. Full-width vertical card list.
*   **Components:**
    *   `StickyTopHeaderBar`: Sticky header containing `WorkspaceSwitcher` dropdown, horizontal text links (Overview, Students, Batches, Question Bag, Tests, Rooms, Settings), user profile avatar, and theme toggler.
    *   `WelcomeHeroPanel`: Displays greeting text, summary sentence of active items, and a stylized card showing the active **Workspace Code** (e.g. `ORIGIN-JEE-A1`) with "Copy Link", "WhatsApp Share", and "Rotate Code" action buttons.
    *   `ActiveAlertsGrid`: Group of three status-border cards:
        1.  *Unassigned Student Queue Alert* (Amber indicator)
        2.  *Low Confidence Import Alert* (Blue indicator)
        3.  *Live Test Session Telemetry* (Emerald pulse indicator)
    *   `ScheduleTimeline`: A vertical node list displaying scheduled mock tests, live sessions, and homework releases for today.

---

### Page 2: Students Directory & Onboarding Queue
**Route:** `/teacher/workspaces/[workspaceId]/students`  
*Focus:* Approving newly enrolled students and managing batch mappings.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Main Area split 70:30 (Left pane: Directory/Queue list, Right pane: Batch Allocator slide drawer).
    *   **Tablet:** Sticky Top Navigation Header + Stacked vertically (Top: Queue carousel, Bottom: Active Directory grid; Batch Allocator opens in a full-screen overlay/modal).
    *   **Mobile:** Bottom Nav + Flat list. Unassigned student requests appear as swipeable cards at the top, followed by a flat search table.
*   **Components:**
    *   `DirectoryTabSwitcher`: Horizontal tabs: "Active Directory", "Onboarding Queue (X)", "Suspended/Left".
    *   `SearchFilterBar`: Text search input + "Filter by Batch" multi-select dropdown + "Manual Invite" action button.
    *   `UnassignedQueueCardList`: Student check-list cards displaying avatar, name, email, join time, source badge, and single/bulk select controls.
    *   `BatchAllocatorDrawer`: Sidebar pane that displays active batches with checkboxes and a primary action button labeled "Assign Batch (X Selected)".
    *   `StudentDirectoryTable`: Read-only table columns: Name, Batch Badges (multi-color pills), Overall Accuracy (mini circular radial tracker), Last Activity Time, Status Badge (Active/Suspended), and Action menu.

---

### Page 3: Batch Details & Syllabus Planner
**Route:** `/teacher/workspaces/[workspaceId]/batches/[batchId]`  
*Focus:* syllabus completion and assigned mock tests/materials.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Split-Pane 30:70 (Left pane: Batch stats & co-teachers; Right pane: Syllabus tree & planners).
    *   **Tablet:** Sticky Top Navigation Header + Stacked columns (Syllabus rings on top, calendar/tree layout below).
    *   **Mobile:** Bottom Nav. Batch header card at top, swipeable subject selectors (Physics, Chemistry, Math), and flat checklist of chapters.
*   **Components:**
    *   `BatchSummaryCard`: Displays targets, student count, weekly calendar, and assigned co-teachers.
    *   `SyllabusProgressRing`: Radial HSL-colored circle displaying completion percentage and batch-wide concept strengths.
    *   `PlannerTabSystem`: Horizontal tabs for "Syllabus Tree", "Mock Tests", "Study Materials".
    *   `SyllabusChapterTree`: Multi-level list of Chapters. Chapters expand to show Concept items. Each Concept item displays a status badge: "Mastered" (Emerald, >75% accuracy), "In Progress" (Amber, 50-75% accuracy), "Unstarted" (Gray).
    *   `StudyMaterialsUploader`: Dashed drag-and-drop file upload zone (links to R2 bucket) next to a list of active batch attachments with view-count logs.

---

### Page 4: Question Bag Library & Manual Editor
**Route:** `/teacher/workspaces/[workspaceId]/question-bag`  
*Focus:* Question bank searching, filtering, and manual creation/editing.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Split-pane 40:60 (Left pane: library directory; Right pane: authoring editor).
    *   **Tablet:** Sticky Top Navigation Header + Split-pane 50:50 (Vertical list on left, Editor form on right).
    *   **Mobile:** Bottom Nav. Library list fills screen; clicking a question slides in the authoring editor as a full-screen overlay.
*   **Components:**
    *   `QuestionFilters`: Left accordion panel filterable by Subject, Chapter, Topic, Difficulty (Easy, Medium, Hard, Insane), and Question Type (MCQ, MSQ, Numerical, Matrix, Subjective).
    *   `LibraryQuestionCardList`: Scrollable cards showing question stem snippets rendered with LaTeX math support, metadata pills, checkbox, and status badge ("Draft", "Ready", "OGCode Published").
    *   `QuestionTypeSelector`: Horizontal button group with question type icons.
    *   `LaTeXStemEditor`: Markdown text area with a live preview pane rendering mathematical equations.
    *   `DynamicOptionsGrid`: Adapts inputs based on selected Question Type (Radio buttons for MCQ, Checkboxes for MSQ, Matrix grid inputs, numerical fields with expected units).
    *   `MetadataPanel`: Fields for Hints, Explanations, Full Solved Solutions (required for public OGCode), and a drag-and-drop reference diagram/image uploader.

---

### Page 5: Document Import Pipeline & Review Panel
**Route:** `/teacher/workspaces/[workspaceId]/question-bag/import`  
*Focus:* Side-by-side parsing verification of uploaded PDFs and images.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Split screen 50:50 (Left pane: PDF view; Right pane: Editor panels).
    *   **Tablet:** Split screen 50:50 (Smaller viewing frames, side-by-side).
    *   **Mobile:** Wizard style. Step 1 displays PDF page crop canvas, Step 2 displays edit text box.
*   **Components:**
    *   `ImportProgressBar`: Steps indicating "Queued -> Classifying -> Extracting -> Reconciling -> Reviewing".
    *   `PDFViewerOverlay`: Scrollable page snapshot viewer. Displays a selection cropping box overlays over original text.
    *   `ParsedQuestionsList`: Cards representing parsed items. Cards flag validation warnings:
        *   *Amber Warning Outline:* "Missing Answer Key" or "Low Confidence Options".
        *   *Diagram Crop Button:* Action to link cropped regions from the left PDF to the question version.
    *   `ImportActionControls`: Sticky footer displaying "Bulk Approve Ready Questions" and "Complete Import".

---

### Page 6: Scheduled Test Creator & Builder
**Route:** `/teacher/workspaces/[workspaceId]/tests`  
*Focus:* Scheduling exams and building mock test configurations.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Horizontal progress bar + 3-step form wizard (Details -> Question Cart -> Target & Schedule).
    *   **Tablet/Mobile:** Single scroll form divided into three expandable cards.
*   **Components:**
    *   `WizardProgressHeader`: Nodes mapping "Details -> Select -> Schedule".
    *   `TestSettingsForm`: Fields for Test Title, Duration (in minutes), Description, and Scoring Policy (+4/-1 vs custom input).
    *   `QuestionSelectorCart`: Split pane showing question bank filter catalog on left, and selected "Test Question Cart" on right with drag-and-drop handles for position sorting.
    *   `TargetSchedulerCard`: Selection dropdowns for Batches, Date/Time window pickers (Start Date vs End Date), and toggle controls ("Auto-submit", "Shuffle", "Hide Live Leaderboard").

---

### Page 7: Live Study Room Real-Time Dashboard
**Route:** `/teacher/workspaces/[workspaceId]/rooms/[roomId]`  
*Focus:* Live telemetry and student scoring during ongoing exams.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Main Area Split 70:30 (Left pane: telemetry charts & presence grids; Right pane: live leaderboard).
    *   **Tablet:** Sticky Top Navigation Header + stacked layout (Leaderboard spans top, telemetry grid below).
    *   **Mobile:** Bottom Nav. Header countdown timer at top, sliding tab panel displaying "Leaderboard" or "Live Status".
*   **Components:**
    *   `RoomHeaderWidget`: Displays Room Code in large bold font, ticking countdown timer, and control buttons ("Pause", "+5 Min", "End Test").
    *   `LiveAccuracyMatrix`: Grid of test question numbers. Clicking a question card opens a modal showing:
        *   Response distribution bar charts.
        *   Average attempt speed.
        *   "Struggling alert" flag.
    *   `LiveLeaderboard`: Real-time ranking list showing Student Name, Answer Progress Bar, current score, and speed.
    *   `PresenceGrid`: Grid of student tiles with colored pulsing status indicators ("Active", "Idle", "Submitted", "Disconnected").

---

### Page 8: Analytics Center & Weakness Remediation
**Route:** `/teacher/workspaces/[workspaceId]/analytics`  
*Focus:* Radar charts and assigning remedial worksheets based on topic weaknesses.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + 2-Column Grid (Left: Radar chart; Right: Weakness list & tables).
    *   **Tablet/Mobile:** Sticky Top Navigation Header + Vertical stacked column. Chart at top, followed by intervention cards, followed by tabular grids.
*   **Components:**
    *   `OverviewMetricsBanner`: Small stat boxes displaying Average Score, Syllabus Pacing, Attendance, and Active Weak Concepts.
    *   `MasteryRadarChart`: Multi-axis radar visualization tracking chapter accuracy across Mathematics, Physics, and Chemistry.
    *   `WeakConceptInterventionList`: Grid of concept cards with accuracy metrics below 55%. Card includes details of struggling students and buttons for "Assign Remedial DPP" or "Post Revision Sheet".
    *   `StrugglingStudentsDirectory`: Tabular roster displaying students with declining performance lines (sparklines), test completion consistency, and profiles.

---

### Page 9: OGCode Contributor & Workspace Settings
**Route:** `/teacher/workspaces/[workspaceId]/settings`  
*Focus:* Managing profile settings, inviting staff, and submitting to public bank.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Left Tab list + Right Settings Panels.
    *   **Tablet/Mobile:** Top Tab bar dropdown selector + stacked settings rows.
*   **Components:**
    *   `SettingsNavTabs`: Switcher for "Workspace Info", "Staff Management", "OGCode Roster", "Billing".
    *   `StaffManagementPanel`: Table listing members, role dropdowns (`Owner`, `Admin`, `Teacher`, `Content Manager`), status pills, and "Invite Staff" email modal.
    *   `OGCodeSubmissionList`: List of contributed questions showing verification history, reviewer comments, and moderation badges ("Approved", "Changes Requested", "Rejected").
    *   `AttributionBuilder`: Panel to set teacher display profile and upload academy logo (`/origin-new.jpg`) for public questions.
