'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  Clock,
  Target,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  XCircle,
  Sparkles,
  FileText,
  BookOpen
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { renderFormattedExplanation } from '@/lib/math-text';
import type { TestResult } from '@/types';

interface TestResultViewProps {
  result: TestResult;
  history?: TestResult[];
  onBackToDashboard: () => void;
  onViewDPP: () => void;
  onRetakeTest: () => void;
  showSummary?: boolean;
}

export default function TestResultView({ 
  result,
  history = [],
  onBackToDashboard, 
  onViewDPP,
  onRetakeTest,
  showSummary = true
}: TestResultViewProps) {
  const [selectedSubject, setSelectedSubject] = useState<'overall' | string>('overall');
  const [selectedMistake, setSelectedMistake] = useState(0);

  const subjects = useMemo(() => {
    if (!result || !result.subjectStats) return [];
    return Object.keys(result.subjectStats);
  }, [result]);

  const currentStats = useMemo(() => {
    if (selectedSubject === 'overall' || !result.subjectStats) {
      return {
        score: result.score || 0,
        totalMarks: (result as any).totalMarks || ((result.correctAnswers || 0) + (result.wrongAnswers || 0) + (result.unattempted || 0)) * 4 || 1,
        correct: result.correctAnswers || 0,
        incorrect: result.wrongAnswers || 0,
        unattempted: result.unattempted || 0,
        totalQs: (result.correctAnswers || 0) + (result.wrongAnswers || 0) + (result.unattempted || 0),
        accuracy: result.percentage || (result as any).accuracy || Math.round(((result.correctAnswers || 0) / (((result.correctAnswers || 0) + (result.wrongAnswers || 0)) || 1)) * 100) || 0,
        timeTaken: result.timeTaken || 0,
        // Mocking quality of time for global if not provided, but usually we subtract from total
        timeSpentCorrect: (result as any).timeSpentCorrect || 0,
        timeSpentIncorrect: (result as any).timeSpentIncorrect || 0,
        timeSpentUnattempted: (result as any).timeSpentUnattempted || 0,
      };
    }
    const stats = result.subjectStats[selectedSubject];
    return {
      score: stats.score || 0,
      totalMarks: stats.total_marks || 1,
      correct: stats.correct || 0,
      incorrect: stats.incorrect || 0,
      unattempted: stats.unattempted || 0,
      totalQs: stats.total_qs || 0,
      accuracy: stats.accuracy || 0,
      timeTaken: stats.total_time_spent,
      timeSpentCorrect: stats.time_spent_correct,
      timeSpentIncorrect: stats.time_spent_incorrect,
      timeSpentUnattempted: stats.time_spent_unattempted,
    };
  }, [result, selectedSubject]);



  const formatTimeDigital = (seconds: number) => {
    const hr = Math.floor(seconds / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    if (hr > 0) return `${hr} hr ${min} min ${sec} sec`;
    if (min > 0) return `${min} min ${sec} sec`;
    return `${sec} sec`;
  };



  const displayStrongAreas = useMemo(() => {
    return result.strongAreas || (result as any).strong_areas || [];
  }, [result]);

  const displayWeakAreas = useMemo(() => {
    return result.weakAreas || (result as any).weak_areas || [];
  }, [result]);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans selection:bg-teal-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0F172A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBackToDashboard}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Report Card</h1>
                <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-sm">
                  JEE Main - Previous Year Paper as Mock...
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-3 py-1 rounded-lg">
                Attempt {history.length || 1} <ArrowRight className="w-3 h-3 ml-2 rotate-90" />
              </Badge>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pb-4">
            <Button variant="secondary" className="flex-1 bg-white/10 hover:bg-white/15 text-blue-400 border-none rounded-xl h-10">
              View Solution
            </Button>
            <Button 
              onClick={onRetakeTest}
              variant="secondary" 
              className="flex-1 bg-white/10 hover:bg-white/15 text-blue-400 border-none rounded-xl h-10"
            >
              Reattempt
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-8 overflow-x-auto no-scrollbar border-b border-white/5 mt-2">
            <button 
              onClick={() => setSelectedSubject('overall')}
              className={`pb-4 px-1 text-sm font-bold transition-all relative ${
                selectedSubject === 'overall' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${selectedSubject === 'overall' ? 'text-teal-400' : 'text-slate-500'}`} />
                Overall
              </div>
              {selectedSubject === 'overall' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-400 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]" />}
            </button>
            {subjects.map(sub => (
              <button 
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`pb-4 px-1 text-sm font-bold transition-all relative capitalize ${
                  selectedSubject === sub ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                 <div className="flex items-center gap-2">
                  <Badge className={`w-2 h-2 p-0 rounded-full ${sub.toLowerCase().includes('physics') ? 'bg-orange-500' : sub.toLowerCase().includes('chemistry') ? 'bg-green-500' : 'bg-blue-500'} shadow-[0_0_5px_currentColor]`} />
                  {sub}
                </div>
                {selectedSubject === sub && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-400 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]" />}
              </button>
            ))}
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8 pb-24">
        {showSummary && (
          <div className="p-6 bg-teal-500/10 border border-teal-500/20 rounded-3xl flex items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="w-16 h-16 rounded-2xl bg-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Attempt Summary</h2>
              <p className="text-slate-400 font-medium">
                You scored <span className="text-teal-400 font-bold">{currentStats.score}</span> marks with <span className="text-teal-400 font-bold">{currentStats.accuracy}%</span> accuracy. 
                {currentStats.accuracy > 80 ? " Outstanding performance!" : currentStats.accuracy > 50 ? " Good job, keep it up!" : " Review your mistakes to improve."}
              </p>
            </div>
          </div>
        )}

        {result.isMalpractice && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <p className="text-sm text-red-400 font-medium">
              Malpractice detected. Session was marked due to multiple screen violations.
            </p>
          </div>
        )}

        {/* Marks Obtained Card */}
        <section className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/30 to-blue-500/30 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <Card className="relative bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2rem] overflow-hidden">
            <CardContent className="p-8 flex flex-col items-center">
              <div className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 mb-6 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                Marks Obtained
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-7xl font-black text-white tracking-tighter drop-shadow-2xl">
                  {currentStats.score}
                </span>
                <span className="text-2xl font-bold text-slate-500">/ {currentStats.totalMarks}</span>
              </div>
              <div className="mt-6 flex items-center gap-2">
                <div className={`h-1.5 w-48 bg-slate-800 rounded-full overflow-hidden border border-white/5`}>
                  <div 
                    className="h-full bg-gradient-to-r from-teal-400 to-blue-500 transition-all duration-1000 ease-out"
                    style={{ width: `${(currentStats.score / currentStats.totalMarks) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {Math.round((currentStats.score / currentStats.totalMarks) * 100)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </section>


        {/* Quick Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-[#1E293B]/40 backdrop-blur-lg border-white/5 rounded-2xl p-4 flex flex-col items-center text-center group hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <HelpCircle className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-xl font-black text-white leading-none mb-1">{currentStats.correct + currentStats.incorrect}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Attempted <br/> {currentStats.totalQs} total</div>
          </Card>
          <Card className="bg-[#1E293B]/40 backdrop-blur-lg border-white/5 rounded-2xl p-4 flex flex-col items-center text-center group hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Target className="w-6 h-6 text-teal-400" />
            </div>
            <div className="text-xl font-black text-white leading-none mb-1">{currentStats.accuracy}%</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Accuracy <br/> {selectedSubject === 'overall' ? 'Global' : 'Subject'}</div>
          </Card>
          <Card className="bg-[#1E293B]/40 backdrop-blur-lg border-white/5 rounded-2xl p-4 flex flex-col items-center text-center group hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div className="text-xl font-black text-white leading-none mb-1">
              {Math.floor(currentStats.timeTaken / 60)}m {currentStats.timeTaken % 60}s
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Time Taken <br/> vs {Math.round((result as any).duration || 180)}m limit</div>
          </Card>
        </section>

        {/* Performance Trend (if history exists) */}
        {history && history.length > 1 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-teal-500 rounded-full" />
              <h3 className="text-xl font-black text-white tracking-tight">Performance Trend</h3>
            </div>
            <Card className="bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2rem] p-8">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...history].reverse().slice(-5).map((h, i, arr) => ({
                    attempt: `Attempt ${history.length - arr.length + i + 1}`,
                    score: h.percentage || h.score
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="attempt" hide />
                    <YAxis hide domain={[0, 'dataMax + 10']} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#0F172A] border border-white/10 px-3 py-2 rounded-xl">
                              <p className="text-xs font-bold text-white">{payload[0].value}% Accuracy</p>
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <Bar dataKey="score" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Last {Math.min(history.length, 5)} attempts progress</p>
              </div>
            </Card>
          </section>
        )}




        {/* Attempt Analysis Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-teal-500 rounded-full" />
              <h3 className="text-xl font-black text-white tracking-tight">Attempt Analysis</h3>
            </div>
            <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 font-bold px-3">
              {selectedSubject === 'overall' ? 'Overall' : selectedSubject}
            </Badge>
          </div>

          <Card className="bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-10">
              <div className="flex flex-col md:flex-row items-center justify-around gap-12">
                {/* Donut Chart */}
                <div className="relative h-64 w-64 animate-in fade-in zoom-in duration-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Correct', value: currentStats.correct, color: '#14b8a6' },
                          { name: 'Incorrect', value: currentStats.incorrect, color: '#f43f5e' },
                          { name: 'Not Answered', value: currentStats.unattempted, color: '#475569' },
                        ]}
                        innerRadius={80}
                        outerRadius={105}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {[
                          { name: 'Correct', color: '#14b8a6' },
                          { name: 'Incorrect', color: '#f43f5e' },
                          { name: 'Not Answered', color: '#475569' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-white leading-none">{currentStats.totalQs}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mt-2">Total Qs</span>
                  </div>
                </div>

                {/* Legend/Stats Bar */}
                <div className="flex flex-col gap-6 w-full md:w-auto min-w-[200px]">
                  <div className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Correct</span>
                    </div>
                    <span className="text-xl font-black text-white">{currentStats.correct}</span>
                  </div>
                  <div className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Incorrect</span>
                    </div>
                    <span className="text-xl font-black text-white">{currentStats.incorrect}</span>
                  </div>
                  <div className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-slate-500" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Skipped</span>
                    </div>
                    <span className="text-xl font-black text-white">{currentStats.unattempted}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>


        {/* Quality of Time Spent Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
              <h3 className="text-xl font-black text-white tracking-tight">Quality of Time Spent</h3>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-bold text-blue-400">{formatTimeDigital(currentStats.timeTaken)}</span>
            </div>
          </div>

          <Card className="bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2.5rem] p-8 overflow-hidden">
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Correct', time: currentStats.timeSpentCorrect, color: '#14b8a6' },
                  { name: 'Incorrect', time: currentStats.timeSpentIncorrect, color: '#f43f5e' },
                  { name: 'Skipped', time: currentStats.timeSpentUnattempted, color: '#475569' }
                ]}>
                  <defs>
                    <linearGradient id="barGradientCorrect" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.3}/>
                    </linearGradient>
                    <linearGradient id="barGradientIncorrect" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    </linearGradient>
                    <linearGradient id="barGradientSkipped" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#475569" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#475569" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#0F172A] border border-white/10 px-3 py-2 rounded-xl shadow-2xl">
                            <p className="text-xs font-bold text-white">{formatTimeDigital(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Bar dataKey="time" radius={[12, 12, 0, 0]} barSize={60}>
                    <Cell fill="url(#barGradientCorrect)" />
                    <Cell fill="url(#barGradientIncorrect)" />
                    <Cell fill="url(#barGradientSkipped)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                 <div className="w-2 h-2 rounded-full bg-teal-500 mb-2 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">On Correct</span>
                 <span className="text-sm font-black text-white">{formatTimeDigital(currentStats.timeSpentCorrect)}</span>
               </div>
               <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                 <div className="w-2 h-2 rounded-full bg-rose-500 mb-2 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">On Incorrect</span>
                 <span className="text-sm font-black text-white">{formatTimeDigital(currentStats.timeSpentIncorrect)}</span>
               </div>
               <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                 <div className="w-2 h-2 rounded-full bg-slate-500 mb-2" />
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">On Skipped</span>
                 <span className="text-sm font-black text-white">{formatTimeDigital(currentStats.timeSpentUnattempted)}</span>
               </div>
            </div>
          </Card>
        </section>


        {/* Subject Wise Time Spent (Global Only) */}
        {selectedSubject === 'overall' && result.subjectStats && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                <h3 className="text-xl font-black text-white tracking-tight">Subject Wise Time Spent</h3>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                <span className="text-xs font-bold text-purple-400">Time Breakdown</span>
              </div>
            </div>

            <Card className="bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2.5rem] p-8 overflow-hidden">
              <div className="h-72 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(result.subjectStats).map(([sub, stats]) => ({
                    name: sub,
                    time: stats.total_time_spent,
                    color: sub.toLowerCase().includes('physics') ? '#f97316' : sub.toLowerCase().includes('chemistry') ? '#22c55e' : '#3b82f6'
                  }))}>
                    <defs>
                      <linearGradient id="barGradientPhysics" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="barGradientChemistry" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="barGradientMath" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#0F172A] border border-white/10 px-3 py-2 rounded-xl shadow-2xl">
                              <p className="text-xs font-bold text-white tracking-widest uppercase mb-1 opacity-50">{payload[0].payload.name}</p>
                              <p className="text-sm font-black text-white">{formatTimeDigital(payload[0].value as number)}</p>
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <Bar dataKey="time" radius={[12, 12, 0, 0]} barSize={50}>
                      {
                        Object.entries(result.subjectStats).map(([sub], index) => {
                          const subLower = sub.toLowerCase();
                          let fill = "url(#barGradientMath)";
                          if (subLower.includes('physics')) fill = "url(#barGradientPhysics)";
                          if (subLower.includes('chemistry')) fill = "url(#barGradientChemistry)";
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
                {Object.entries(result.subjectStats).map(([sub, stats]) => (
                  <div key={sub} className="flex flex-col p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                       <div className={`w-3 h-3 rounded-full ${sub.toLowerCase().includes('physics') ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' : sub.toLowerCase().includes('chemistry') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'}`} />
                       <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest capitalize">{sub}</span>
                    </div>
                    <span className="text-sm font-black text-white tracking-tight">{formatTimeDigital(stats.total_time_spent)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}


        {/* Detailed Analysis Tabs */}
        <Tabs defaultValue="analysis" className="relative">
          <TabsList className="bg-[#1E293B]/40 backdrop-blur-lg border border-white/5 p-1 mb-6 rounded-2xl w-full flex overflow-x-auto no-scrollbar">
            <TabsTrigger value="analysis" className="flex-1 data-[state=active]:bg-teal-500 data-[state=active]:text-white rounded-xl transition-all font-bold py-3">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="mistakes" className="flex-1 data-[state=active]:bg-teal-500 data-[state=active]:text-white rounded-xl transition-all font-bold py-3">
              <AlertCircle className="w-4 h-4 mr-2" />
              Mistake Log
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex-1 data-[state=active]:bg-teal-500 data-[state=active]:text-white rounded-xl transition-all font-bold py-3">
              <Target className="w-4 h-4 mr-2" />
              Next Steps
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis">
            <Card className="bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2rem] overflow-hidden group">
              <CardContent className="p-10">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center p-0.5 shadow-lg shadow-teal-500/20">
                    <div className="w-full h-full bg-[#0F172A] rounded-[0.9rem] flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-teal-400 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">AI Diagnostic Report</h3>
                    <p className="text-sm text-slate-400 font-medium">Deep learning analysis of your attempt patterns</p>
                  </div>
                </div>


                <div className="prose prose-invert max-w-none">
                  <p className="text-slate-300 leading-relaxed text-lg font-medium">
                    {result.aiAnalysis?.summary || "Analysis is being generated..."}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mt-12 pt-8 border-t border-white/5">
                  <div className="space-y-4">
                    <h4 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      Core Strengths
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {displayStrongAreas && displayStrongAreas.length > 0 ? (
                        displayStrongAreas.map((area: any, index: number) => (
                          <Badge key={index} className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border-teal-500/20 px-4 py-1.5 rounded-xl transition-colors">
                            {typeof area === 'object' ? `${area.topic} (${area.accuracy}%)` : area}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 italic">No significant strengths identified yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      Focus Zones
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {displayWeakAreas && displayWeakAreas.length > 0 ? (
                        displayWeakAreas.map((area: any, index: number) => (
                          <Badge key={index} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20 px-4 py-1.5 rounded-xl transition-colors">
                            {typeof area === 'object' ? `${area.topic} (${area.accuracy}%)` : area}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 italic">Excellent consistency across topics!</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="mistakes">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Mistake List */}
              <div className="lg:col-span-1 space-y-3">
                {result.aiAnalysis?.mistakes?.length > 0 ? (
                  result.aiAnalysis.mistakes.map((mistake, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedMistake(index)}
                      className={`w-full p-5 rounded-2xl text-left transition-all border group relative overflow-hidden ${selectedMistake === index
                        ? 'bg-teal-500/10 border-teal-500/50 shadow-lg shadow-teal-500/10'
                        : 'bg-[#1E293B]/40 backdrop-blur-md border-white/5 hover:bg-white/5'
                        }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedMistake === index ? 'bg-teal-500 text-white' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-black uppercase tracking-tighter text-sm ${selectedMistake === index ? 'text-teal-400' : 'text-slate-200'}`}>
                            Question {index + 1}
                          </p>
                          <p className="text-xs text-slate-500 font-bold truncate max-w-[150px]">{mistake.concept}</p>
                        </div>
                      </div>
                      {selectedMistake === index && <div className="absolute right-0 top-0 bottom-0 w-1 bg-teal-500" />}
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center bg-[#1E293B]/40 border border-white/5 rounded-2xl">
                    <CheckCircle2 className="w-12 h-12 text-teal-400 mx-auto mb-4 opacity-20" />
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">No mistakes recorded!</p>
                  </div>
                )}
              </div>

              {/* Mistake Detail */}
              <Card className="lg:col-span-2 bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2rem] overflow-hidden group">
                <CardContent className="p-10">
                  {result.aiAnalysis?.mistakes?.[selectedMistake] ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div>
                        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 px-4 py-1.5 rounded-full font-black uppercase tracking-widest text-[10px] mb-4">
                          <XCircle className="w-3 h-3 mr-2" />
                          Category: {result.aiAnalysis.mistakes[selectedMistake].error}
                        </Badge>
                        <h3 className="text-3xl font-black text-white tracking-tight leading-tight">
                          {result.aiAnalysis.mistakes[selectedMistake].concept}
                        </h3>
                      </div>

                      <div className="bg-white/5 rounded-3xl p-8 border border-white/5 relative group/item">
                        <div className="absolute -left-1 top-8 bottom-8 w-1 bg-teal-500 rounded-full opacity-50" />
                        <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                          <BookOpen className="w-4 h-4 text-teal-500" />
                          Diagnostic Insight
                        </h4>
                        <div className="text-slate-300 leading-relaxed font-medium">
                          {renderFormattedExplanation(result.aiAnalysis.mistakes[selectedMistake].explanation)}
                        </div>
                      </div>

                      <div className="bg-teal-500/5 rounded-3xl p-8 border border-teal-500/10 relative">
                        <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                          <Target className="w-4 h-4 text-teal-500" />
                          Recommended strategy
                        </h4>
                        <div className="text-slate-300 leading-relaxed font-medium">
                          {renderFormattedExplanation(result.aiAnalysis.mistakes[selectedMistake].howToApproach)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 pt-4">
                        <Button className="rounded-2xl bg-gradient-to-r from-teal-500 to-blue-600 text-white font-black uppercase tracking-widest text-xs px-8 h-14 shadow-lg shadow-teal-500/20 hover:scale-[1.02] transition-transform">
                          <BookOpen className="w-4 h-4 mr-3" />
                          Fix Concept
                        </Button>
                        <Button variant="outline" className="rounded-2xl bg-white/5 border-white/10 text-white font-black uppercase tracking-widest text-xs px-8 h-14 hover:bg-white/10 transition-colors">
                          <Sparkles className="w-4 h-4 mr-3 text-teal-400" />
                          Explain with AI
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                      <Sparkles className="w-16 h-16 text-teal-400" />
                      <p className="text-lg font-bold text-white">Select a mistake to see deep analysis</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          <TabsContent value="recommendations">
            <Card className="bg-[#1E293B]/40 backdrop-blur-xl border-white/10 rounded-[2rem] overflow-hidden group">
              <CardContent className="p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                    <Target className="w-6 h-6 text-teal-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Adaptive Learning Path</h3>
                </div>

                <div className="space-y-4">
                  {result.aiAnalysis.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-5 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:translate-x-1 transition-all group/item"
                    >
                      <div className="w-10 h-10 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0 font-black text-sm">
                        {index + 1}
                      </div>
                      <p className="text-slate-300 font-medium leading-relaxed">{rec}</p>
                      <ArrowRight className="w-5 h-5 text-teal-500 ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>

                <div className="mt-12 p-10 rounded-[2.5rem] bg-gradient-to-br from-teal-500/20 to-blue-600/20 border border-teal-500/20 relative overflow-hidden group/dpp">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/dpp:scale-110 transition-transform">
                    <Sparkles className="w-32 h-32 text-teal-400" />
                  </div>
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                        <Badge className="bg-teal-500 text-white font-black px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest shadow-lg shadow-teal-500/40">AI Generated</Badge>
                        <h4 className="font-black text-white text-xl tracking-tight">Practice Engine Ready</h4>
                      </div>
                      <p className="text-slate-400 font-medium">
                        We've curated a hyper-personalized problem set strictly focused on your mistake patterns.
                        Solve these to permanently eliminate weak spots.
                      </p>
                    </div>
                    <Button
                      onClick={onViewDPP}
                      className="bg-white text-[#0F172A] hover:bg-slate-200 font-black uppercase tracking-widest text-xs h-14 px-10 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                      <FileText className="w-4 h-4 mr-3" />
                      Generate DPP
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
