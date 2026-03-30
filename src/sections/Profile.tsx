'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  User,
  GraduationCap,
  Crown,
  Edit3,
  BookOpen,
  Clock,
  Trophy,
  TrendingUp,
  Target,
  Calendar,
  Camera,
  Settings,
  Bell,
  Shield,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { User as UserType, StreakData } from '@/types';
import PhotoBooth from '@/components/profile/PhotoBooth';

interface ProfileProps {
  user: UserType;
  streakData: StreakData;
  onBack: () => void;
  onUpgrade: () => void;
}

export default function Profile({ user, streakData, onBack, onUpgrade }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [editData, setEditData] = useState({
    name: user.name,
    class: user.class || '',
    selectedCourse: user.selectedCourse || '',
    subjects: user.subjects || [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await apiCall('/users/me/', {
        method: 'PATCH',
        body: JSON.stringify(editData),
      });
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subjectProgress = [
    { subject: 'Physics', progress: 75, color: 'bg-blue-500 dark:bg-blue-600' },
    { subject: 'Chemistry', progress: 60, color: 'bg-green-500 dark:bg-green-600' },
    { subject: 'Mathematics', progress: 85, color: 'bg-purple-500 dark:bg-purple-600' },
  ];

  const achievements = [
    { name: 'First Test', description: 'Completed your first test', icon: BookOpen, unlocked: true },
    { name: '7-Day Streak', description: 'Studied 7 days in a row', icon: TrendingUp, unlocked: true },
    { name: 'Doubt Master', description: 'Solved 50 doubts', icon: Target, unlocked: true },
    { name: 'Top 100', description: 'Reached top 100 rank', icon: Trophy, unlocked: false },
    { name: 'Perfect Score', description: 'Scored 100% on a test', icon: Crown, unlocked: false },
    { name: '30-Day Streak', description: 'Studied 30 days in a row', icon: Calendar, unlocked: false },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-300 relative overflow-x-hidden">
      {/* Premium Background Decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 30%, rgba(29, 78, 216, 0.3) 0%, transparent 40%),
                               radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.15) 0%, transparent 40%)`
        }}>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#020617]/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center gap-4">
                <button
                  onClick={onBack}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />
                <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Profile Settings</h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleDarkMode}
                  className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full mb-20">
          {/* Profile Header */}
          <Card className="border-0 shadow-2xl shadow-indigo-500/5 bg-white dark:bg-slate-900/60 backdrop-blur-xl mb-10 relative overflow-hidden ring-1 ring-slate-100 dark:ring-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/10 pointer-events-none" />
            <CardContent className="relative z-10 p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                {/* Avatar */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-full opacity-30 blur group-hover:opacity-50 transition duration-500" />
                  <Avatar className="w-28 h-28 border-4 border-white dark:border-slate-800 relative z-10">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-4xl font-black">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 hover:scale-110 transition-transform z-20">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-4 mb-3">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{user.name}</h2>
                    {user.isPremium && (
                      <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/20 border-0 h-6">
                        <Crown className="w-3 h-3 mr-1" />
                        PREMIUM
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-5">{user.email}</p>

                  <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                    {isEditing ? (
                      <div className="flex flex-col gap-4 w-full">
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Class</label>
                            <select
                              value={editData.class}
                              onChange={(e) => setEditData({ ...editData, class: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 dark:text-white"
                            >
                              <option value="9">Class 9</option>
                              <option value="10">Class 10</option>
                              <option value="11">Class 11</option>
                              <option value="12">Class 12</option>
                              <option value="dropper">Dropper</option>
                            </select>
                          </div>
                          <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Course</label>
                            <select
                              value={editData.selectedCourse}
                              onChange={(e) => setEditData({ ...editData, selectedCourse: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 dark:text-white"
                            >
                              <option value="JEE">JEE</option>
                              <option value="NEET">NEET</option>
                              {['9', '10'].includes(editData.class) && (
                                <option value="Foundation">Foundation</option>
                              )}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Subjects</label>
                          <div className="flex flex-wrap gap-2">
                            {['Physics', 'Chemistry', 'Mathematics', 'Biology'].map(s => (
                              <Badge
                                key={s}
                                onClick={() => {
                                  const newSubjects = editData.subjects.includes(s)
                                    ? editData.subjects.filter(sub => sub !== s)
                                    : [...editData.subjects, s];
                                  setEditData({ ...editData, subjects: newSubjects });
                                }}
                                className={`cursor-pointer px-4 py-1.5 h-auto text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${editData.subjects.includes(s)
                                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                  : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 border border-transparent'
                                  }`}
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-0 shadow-sm font-bold text-[10px] uppercase tracking-wider">
                          <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
                          Class {editData.class === 'dropper' ? 'Dropper' : (editData.class || 'Not Set')}
                        </Badge>
                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-0 shadow-sm font-bold text-[10px] uppercase tracking-wider">
                          <Target className="w-3.5 h-3.5 mr-1.5" />
                          {editData.selectedCourse || 'No Course'}
                        </Badge>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {editData.subjects.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-[10px] font-bold border-indigo-500/20 text-indigo-500">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit Button */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={isLoading}
                    className={`rounded-xl px-6 h-11 font-bold transition-all shadow-sm ${isEditing
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                  >
                    {isEditing ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Profile
                      </>
                    )}
                  </Button>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      className="text-xs text-slate-500"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { label: 'Tests Taken', value: '24', icon: BookOpen, color: 'text-blue-500 shadow-blue-500/10' },
              { label: 'Study Hours', value: '156', icon: Clock, color: 'text-emerald-500 shadow-emerald-500/10' },
              { label: 'Current Streak', value: `${streakData.currentStreak} days`, icon: TrendingUp, color: 'text-orange-500 shadow-orange-500/10' },
              { label: 'Global Rank', value: '#247', icon: Trophy, color: 'text-indigo-500 shadow-indigo-500/10' },
            ].map((stat, index) => (
              <Card key={index} className="border-0 shadow-lg bg-white dark:bg-slate-900/60 backdrop-blur-xl ring-1 ring-slate-100 dark:ring-white/5 hover:scale-[1.02] transition-all group cursor-default">
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{stat.value}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="progress" className="mb-10">
            <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1.5 w-full h-14 rounded-2xl backdrop-blur-md">
              {[
                { value: 'progress', icon: TrendingUp, label: 'Progress' },
                { value: 'photobooth', icon: Sparkles, label: 'AI Booth' },
                { value: 'achievements', icon: Trophy, label: 'Achievements' },
                { value: 'settings', icon: Settings, label: 'Settings' }
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 h-full rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-lg text-slate-500 dark:text-slate-400 font-bold text-sm tracking-tight transition-all"
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="progress" className="mt-8">
              <Card className="border-0 shadow-xl bg-white dark:bg-slate-900/60 backdrop-blur-xl ring-1 ring-slate-100 dark:ring-white/5 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-black flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                    Subject Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {subjectProgress.map((subject) => (
                      <div key={subject.subject}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-900 dark:text-white">{subject.subject}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">{subject.progress}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${subject.color} rounded-full transition-all duration-500`}
                            style={{ width: `${subject.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-8 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 dark:to-slate-800/20 ring-1 ring-indigo-500/20">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-2">Overall Performance</h4>
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 relative flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
                          <circle
                            cx="48"
                            cy="48"
                            r="42"
                            fill="none"
                            stroke="url(#indigo-grad)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${0.73 * 264} 264`}
                          />
                          <defs>
                            <linearGradient id="indigo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">73%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">You're doing great! Your performance is <span className="text-emerald-500 font-bold">15% higher</span> than last month. Keep it up!</p>
                        <Button
                          variant="ghost"
                          className="text-indigo-600 dark:text-indigo-400 p-0 h-auto mt-2 font-bold hover:bg-transparent"
                          onClick={onBack}
                        >
                          Continue Learning →
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photobooth" className="mt-8">
              <PhotoBooth />
            </TabsContent>

            <TabsContent value="achievements" className="mt-8">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {achievements.map((achievement, index) => (
                  <Card
                    key={index}
                    className={`border-0 shadow-lg ${achievement.unlocked ? 'bg-white dark:bg-slate-900/60' : 'bg-slate-50/50 dark:bg-slate-800/10 opacity-60'} backdrop-blur-xl ring-1 ring-slate-100 dark:ring-white/5 group transition-all`}
                  >
                    <CardContent className="p-8 text-center">
                      <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${achievement.unlocked
                        ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20'
                        : 'bg-slate-100 dark:bg-slate-800'
                        }`}>
                        <achievement.icon className={`w-8 h-8 ${achievement.unlocked ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                      </div>
                      <h4 className="font-black text-slate-800 dark:text-white tracking-tight leading-tight mb-1">{achievement.name}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{achievement.description}</p>
                      {achievement.unlocked && (
                        <Badge className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-0 font-bold text-[9px]">UNLOCKED</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-8">
              <Card className="border-0 shadow-xl bg-white dark:bg-slate-900/60 backdrop-blur-xl ring-1 ring-slate-100 dark:ring-white/5">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {[
                      { icon: User, label: 'Personal Information', desc: 'Update your name, email, and bio', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' },
                      { icon: Bell, label: 'Notifications', desc: 'Manage your alert preferences', color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500' },
                      { icon: Shield, label: 'Privacy & Security', desc: 'Password, 2FA, and sessions', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' }
                    ].map((item, idx) => (
                      <button key={idx} className="w-full flex items-center gap-5 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50 group">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>
                          <item.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="font-bold text-slate-800 dark:text-white leading-tight">{item.label}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 rotate-180 transition-all" />
                      </button>
                    ))}

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                      {!user.isPremium && (
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                          <div className="flex items-center gap-4 mb-3 relative z-10">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                              <Crown className="w-6 h-6 text-amber-300" />
                            </div>
                            <h4 className="font-black text-lg tracking-tight">Upgrade to ORIGIN Pro</h4>
                          </div>
                          <p className="text-white/80 text-xs mb-5 font-medium leading-relaxed relative z-10">
                            Unlock unlimited mock tests, deep performance analysis, and priority doubt resolution.
                          </p>
                          <Button
                            onClick={onUpgrade}
                            className="w-full bg-white text-indigo-600 hover:bg-white/90 font-black h-11 rounded-xl shadow-lg relative z-10"
                          >
                            Unlock Premium Access
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}