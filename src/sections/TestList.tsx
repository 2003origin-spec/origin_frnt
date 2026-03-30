'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Search,
  Clock,
  HelpCircle,
  BarChart3,
  ChevronLeft,
  Play,
  RotateCcw,
  Lock,
  CheckCircle2,
  Flame,
  BookOpen,
  Atom,
  Calculator,
  Plus,
  Loader2
} from 'lucide-react';
import type { Test, User } from '@/types';
import { apiCall } from '@/lib/api';

interface TestListProps {
  onStartTest: (test: Test) => void;
  onViewAnalysis: (test: Test) => void;
  onBack: () => void;
  user: User;
}

export default function TestList({ onStartTest, onViewAnalysis, onBack, user }: TestListProps) {
  const [tests, setTests] = useState<Test[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [loading, setLoading] = useState(true);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTestConfig, setCustomTestConfig] = useState({
    subject: 'all',
    difficulty: 'medium',
    chapter: '',
    question_count: 10
  });
  const [creatingTest, setCreatingTest] = useState(false);
  const [customTestError, setCustomTestError] = useState('');

  const handleCreateCustomTest = async () => {
    setCreatingTest(true);
    setCustomTestError('');
    try {
      const response = await apiCall('/assessments/tests/custom/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customTestConfig)
      });
      // Add the new test to the top of the list
      setTests([response, ...tests]);
      setShowCustomModal(false);
      // Auto-start the test after creating it
      onStartTest(response);
    } catch (error: any) {
      setCustomTestError(error.message || 'Failed to create custom test. Try making it broader.');
    } finally {
      setCreatingTest(false);
    }
  };

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const data = await apiCall('/assessments/tests/');
        setTests(data);
      } catch (error) {
        console.error('Failed to fetch tests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, []);

  const filteredTests = tests.filter((test) => {
    const matchesSearch = test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || test.subject === selectedSubject;
    const matchesDifficulty = selectedDifficulty === 'all' || test.difficulty === selectedDifficulty;
    return matchesSearch && matchesSubject && matchesDifficulty;
  });

  const getSubjectIcon = (subject: string) => {
    switch (subject) {
      case 'physics':
        return <Atom className="w-5 h-5" />;
      case 'chemistry':
        return <Flame className="w-5 h-5" />;
      case 'mathematics':
        return <Calculator className="w-5 h-5" />;
      default:
        return <BookOpen className="w-5 h-5" />;
    }
  };

  const getSubjectColor = (subject: string) => {
    switch (subject) {
      case 'physics':
        return 'bg-blue-100 text-blue-600';
      case 'chemistry':
        return 'bg-green-100 text-green-600';
      case 'mathematics':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-amber-100 text-amber-600';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-600';
      case 'medium':
        return 'bg-amber-100 text-amber-600';
      case 'hard':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-900/30">
      {/* Header */}
      <header className="sticky top-0 z-40 glass dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Test Series</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Choose a test to begin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCustomModal(true)} className="bg-[#3CACA3] hover:bg-[#3CACA3]/90 text-white rounded-full hidden sm:flex">
                <Plus className="w-4 h-4 mr-2" />
                Custom Test
              </Button>
              <Button onClick={() => setShowCustomModal(true)} size="icon" className="bg-[#3CACA3] hover:bg-[#3CACA3]/90 text-white rounded-full sm:hidden">
                <Plus className="w-4 h-4" />
              </Button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-medium">{user.streak || 0} day streak</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading tests...</div>
        ) : (
          <>
            {/* Search and Filters */}
            <div className="mb-8 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search tests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 focus:border-[#3CACA3] focus:ring-[#3CACA3]/20 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 focus:border-[#3CACA3] focus:outline-none"
                  >
                    <option value="all">All Subjects</option>
                    <option value="physics">Physics</option>
                    <option value="chemistry">Chemistry</option>
                    <option value="mathematics">Mathematics</option>
                    <option value="mixed">Mixed</option>
                  </select>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 focus:border-[#3CACA3] focus:outline-none"
                  >
                    <option value="all">All Levels</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="all" className="mb-8">
              <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
                <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-[#3CACA3] dark:data-[state=active]:text-teal-400 dark:text-slate-400">
                  All Tests
                </TabsTrigger>
                <TabsTrigger value="recommended" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-[#3CACA3] dark:data-[state=active]:text-teal-400 dark:text-slate-400">
                  Recommended
                </TabsTrigger>
                <TabsTrigger value="attempted" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-[#3CACA3] dark:data-[state=active]:text-teal-400 dark:text-slate-400">
                  Attempted
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTests.map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="recommended" className="mt-6">
                {/* Show a banner if user has preferences set */}
                {user.subjects && user.subjects.length > 0 && (
                  <div className="mb-4 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-sm font-medium flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Showing tests for your subjects: {user.subjects.join(', ')}
                  </div>
                )}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTests
                    .filter(t => !t.attempted)
                    .filter(t => {
                      // If user has subject preferences, filter by them
                      if (user.subjects && user.subjects.length > 0) {
                        return user.subjects.some(sub =>
                          t.subject.toLowerCase() === sub.toLowerCase() || t.subject === 'mixed'
                        );
                      }
                      return true; // No preferences yet, show all
                    })
                    .map((test) => (
                      <TestCard
                        key={test.id}
                        test={test}
                        onStart={() => onStartTest(test)}
                        onViewAnalysis={() => onViewAnalysis(test)}
                        user={user}
                        getSubjectIcon={getSubjectIcon}
                        getSubjectColor={getSubjectColor}
                        getDifficultyColor={getDifficultyColor}
                      />
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="attempted" className="mt-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTests.filter(t => t.attempted).map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {filteredTests.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Search className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No tests found</h3>
                <p className="text-slate-500 dark:text-slate-400">Try adjusting your search or filters</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Custom Test Modal */}
      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent className="sm:max-w-[425px] dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle>Create Custom Test</DialogTitle>
            <DialogDescription>
              Generate a personalized test tailored to your needs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <select
                value={customTestConfig.subject}
                onChange={(e) => setCustomTestConfig({ ...customTestConfig, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3CACA3]"
              >
                <option value="all">All Subjects (Mixed)</option>
                <option value="physics">Physics</option>
                <option value="chemistry">Chemistry</option>
                <option value="mathematics">Mathematics</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <select
                value={customTestConfig.difficulty}
                onChange={(e) => setCustomTestConfig({ ...customTestConfig, difficulty: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3CACA3]"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Chapter (Optional)</Label>
              <Input
                placeholder="e.g. Kinematics"
                value={customTestConfig.chapter}
                onChange={(e) => setCustomTestConfig({ ...customTestConfig, chapter: e.target.value })}
                className="border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Number of Questions</Label>
                <span className="text-sm text-slate-500">{customTestConfig.question_count}</span>
              </div>
              <Slider
                value={[customTestConfig.question_count]}
                onValueChange={(val) => setCustomTestConfig({ ...customTestConfig, question_count: val[0] })}
                max={50}
                min={5}
                step={5}
                className="py-2"
              />
            </div>
            {customTestError && (
              <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded text-center">
                {customTestError}
              </div>
            )}
          </div>
          <Button
            onClick={handleCreateCustomTest}
            disabled={creatingTest}
            className="w-full bg-[#3CACA3] hover:bg-[#3CACA3]/90 text-white"
          >
            {creatingTest ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {creatingTest ? 'Generating...' : 'Generate and Start'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TestCardProps {
  test: Test;
  onStart: () => void;
  onViewAnalysis: () => void;
  user: User;
  getSubjectIcon: (subject: string) => React.ReactNode;
  getSubjectColor: (subject: string) => string;
  getDifficultyColor: (difficulty: string) => string;
}

function TestCard({ test, onStart, onViewAnalysis, user, getSubjectIcon, getSubjectColor, getDifficultyColor }: TestCardProps) {
  const isLocked = test.isPremium && !user.isPremium;

  return (
    <Card className={`border-0 shadow-soft hover:shadow-lg transition-all duration-300 ${isLocked ? 'opacity-75' : ''} dark:bg-slate-900/60 dark:border dark:border-slate-800`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl ${getSubjectColor(test.subject)} flex items-center justify-center`}>
            {getSubjectIcon(test.subject)}
          </div>
          <div className="flex gap-2">
            {test.attempted && (
              <Badge className="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Done ({test.attemptCount} {test.attemptCount === 1 ? 'attempt' : 'attempts'})
              </Badge>
            )}
            {isLocked && (
              <Badge className="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <Lock className="w-3 h-3 mr-1" />
                Pro
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{test.title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{test.description}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <HelpCircle className="w-4 h-4" />
            {test.totalQuestions} Qs
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {test.duration} min
          </div>
          <Badge variant="secondary" className={getDifficultyColor(test.difficulty)}>
            {test.difficulty}
          </Badge>
        </div>

        {/* Score if attempted */}
        {test.attempted && test.score !== null && test.score !== undefined && (
          <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Average Score</span>
              <span className="text-lg font-bold text-[#3CACA3] dark:text-teal-400">{test.score}%</span>
            </div>
            {test.allScores && test.allScores.length > 1 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Previous Attempts</span>
                <div className="flex flex-wrap gap-1.5">
                  {test.allScores.map((s, idx) => (
                    <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 dark:border-slate-700 text-slate-500">
                      {s}%
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        {isLocked ? (
          <Button
            disabled
            className="w-full rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
          >
            <Lock className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>
        ) : test.attempted ? (
          <div className="flex flex-col gap-2">
            <Button
              onClick={onViewAnalysis}
              className="w-full rounded-full bg-[#3CACA3]/10 text-[#3CACA3] hover:bg-[#3CACA3]/20 dark:bg-teal-500/10 dark:text-teal-400 dark:hover:bg-teal-500/20"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              View Analysis
            </Button>
            <Button
              onClick={onStart}
              variant="outline"
              className="w-full rounded-full border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Attempt Again
            </Button>
          </div>
        ) : (
          <Button
            onClick={onStart}
            className="w-full rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] dark:from-teal-600 dark:to-slate-800 text-white hover:opacity-90"
          >
            <Play className="w-4 h-4 mr-2" />
            Attempt Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
