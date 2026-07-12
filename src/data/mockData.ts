import type { DoubtSession, StreakData, LeaderboardEntry, Book, Note, Bookmark } from '@/types';

export const mockDoubtSessions: DoubtSession[] = [
  {
    id: '1',
    title: 'Circular Motion Doubts',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'I don\'t understand why centripetal acceleration is v²/r. Can you explain?',
        timestamp: new Date('2024-01-15T10:00:00'),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Great question! Let me break it down for you.\n\nWhen an object moves in a circle, its velocity is constantly changing direction (even if speed is constant). This change in velocity means there\'s acceleration.\n\n**Derivation:**\n1. Consider velocity vectors at two close points on the circle\n2. The change in velocity Δv points towards the center\n3. Using similar triangles: Δv/v = Δs/r\n4. So Δv = v(Δs/r)\n5. Acceleration = Δv/Δt = v(Δs/Δt)/r = v²/r\n\n**Key insight:** The faster you go (v) or the tighter the turn (smaller r), the more acceleration you need!\n\nThink of it like this: when you turn a corner in a car, you feel pushed outward - that\'s because the car is accelerating inward (towards the center of the turn) to change your direction.',
        timestamp: new Date('2024-01-15T10:01:00'),
      },
    ],
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:01:00'),
  },
];

export const mockStreakData: StreakData = {
  currentStreak: 5,
  longestStreak: 12,
  lastStudyDate: new Date(),
  weeklyData: [true, true, true, true, true, false, false],
};

export const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, userId: '2', name: 'Aarav Sharma', score: 9850, studyTime: 420, location: 'Mumbai', isLive: true },
  { rank: 2, userId: '3', name: 'Priya Patel', score: 9720, studyTime: 380, location: 'Delhi', isLive: false },
  { rank: 3, userId: '4', name: 'Rahul Kumar', score: 9680, studyTime: 410, location: 'Bangalore', isLive: true },
  { rank: 4, userId: '5', name: 'Sneha Gupta', score: 9540, studyTime: 350, location: 'Mumbai', isLive: false },
  { rank: 5, userId: '6', name: 'Vikram Rao', score: 9420, studyTime: 390, location: 'Hyderabad', isLive: true },
  { rank: 6, userId: '7', name: 'Neha Singh', score: 9380, studyTime: 360, location: 'Pune', isLive: false },
  { rank: 7, userId: '8', name: 'Arjun Mehta', score: 9250, studyTime: 340, location: 'Mumbai', isLive: false },
  { rank: 8, userId: '9', name: 'Kavya Iyer', score: 9180, studyTime: 370, location: 'Chennai', isLive: true },
  { rank: 9, userId: '10', name: 'Rohan Desai', score: 9050, studyTime: 320, location: 'Delhi', isLive: false },
  { rank: 10, userId: '11', name: 'Ananya Reddy', score: 8920, studyTime: 310, location: 'Bangalore', isLive: false },
];

export const mockBooks: Book[] = [
  {
    id: 'ncert-phy-11-1',
    title: 'Physics Part I - Class 11',
    bookClass: '11',
    subject: 'Physics',
    coverImage: 'https://images.unsplash.com/photo-1636466497769-f81855aebf13?auto=format&fit=crop&q=80&w=400',
    isLiked: true,
    chapters: [
      { id: 'ch1', title: 'Physical World', pages: 15 },
      { id: 'ch2', title: 'Units and Measurements', pages: 22 },
      { id: 'ch3', title: 'Motion in a Straight Line', pages: 18 },
      { id: 'ch4', title: 'Motion in a Plane', pages: 25 },
    ]
  },
  {
    id: 'ncert-chem-11-1',
    title: 'Chemistry Part I - Class 11',
    bookClass: '11',
    subject: 'Chemistry',
    coverImage: 'https://images.unsplash.com/photo-1603126857599-f6e15782fd5d?auto=format&fit=crop&q=80&w=400',
    isLiked: false,
    chapters: [
      { id: 'ch1', title: 'Some Basic Concepts of Chemistry', pages: 20 },
      { id: 'ch2', title: 'Structure of Atom', pages: 28 },
      { id: 'ch3', title: 'Classification of Elements', pages: 16 },
    ]
  },
  {
    id: 'ncert-math-12-1',
    title: 'Mathematics Part I - Class 12',
    bookClass: '12',
    subject: 'Mathematics',
    coverImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=400',
    isLiked: false,
    chapters: [
      { id: 'ch1', title: 'Relations and Functions', pages: 25 },
      { id: 'ch2', title: 'Inverse Trigonometric Functions', pages: 18 },
      { id: 'ch3', title: 'Matrices', pages: 30 },
    ]
  },
  {
    id: 'ncert-bio-11',
    title: 'Biology - Class 11',
    bookClass: '11',
    subject: 'Biology',
    coverImage: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&q=80&w=400',
    isLiked: true,
    chapters: [
      { id: 'ch1', title: 'The Living World', pages: 12 },
      { id: 'ch2', title: 'Biological Classification', pages: 20 },
    ]
  }
];

export const mockLibraryUserSet: string[] = ['ncert-phy-11-1', 'ncert-math-12-1']; // Book IDs the user has added to their library

export const mockNotes: Note[] = [
  {
    id: 'note-1',
    bookId: 'ncert-phy-11-1',
    chapterId: 'ch2',
    pageNumber: 5,
    content: 'Important formula for dimensional analysis: [M^a L^b T^c]',
    color: '#FEF3C7', // yellow-100
    createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000 * 2),
    tags: ['formulas', 'dimensions']
  },
  {
    id: 'note-2',
    bookId: 'ncert-phy-11-1',
    chapterId: 'ch3',
    pageNumber: 12,
    content: 'Difference between average speed and average velocity - speed is strictly scalar.',
    color: '#D1FAE5', // green-100
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
    tags: ['kinematics', 'concepts']
  }
];

export const mockBookmarks: Bookmark[] = [
  {
    id: 'bm-1',
    bookId: 'ncert-phy-11-1',
    pageNumber: 22,
    title: 'Significant Figures Rules',
    createdAt: new Date()
  },
  {
    id: 'bm-2',
    bookId: 'ncert-math-12-1',
    pageNumber: 15,
    title: 'Properties of Inverse Functions',
    createdAt: new Date(Date.now() - 86400000)
  }
];
