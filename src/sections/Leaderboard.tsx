'use client';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Trophy,
  Flame,
  MapPin,
  Users,
  Globe,
  Crown,
  Medal,
  Award,
  Zap,
  Filter
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { User } from '@/types';

interface LeaderboardProps {
  currentUser: User;
  /** Pre-loaded by the Server Component for the 'overall' subject */
  initialLeaderboard?: unknown[];
  initialMyRank?: number | null;
}

export default function Leaderboard({ currentUser, initialLeaderboard, initialMyRank }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState('global');
  const [selectedSubject, setSelectedSubject] = useState<string>('overall');
  const [leaderboard, setLeaderboard] = useState<any[]>((initialLeaderboard as any[]) ?? []);
  const [myRank, setMyRank] = useState<number | null>(initialMyRank ?? null);
  const [isLoading, setIsLoading] = useState(!initialLeaderboard);
  // Track whether we can skip the first 'overall' fetch (SSR already provided it)
  const skipInitialFetch = useRef(!!initialLeaderboard);

  useEffect(() => {
    if (skipInitialFetch.current && selectedSubject === 'overall') {
      skipInitialFetch.current = false;
      return;
    }
    fetchLeaderboard();
  }, [selectedSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const url = selectedSubject === 'overall'
        ? '/assessments/ogcode/leaderboard/'
        : `/assessments/ogcode/leaderboard/?subject=${selectedSubject}`;
      const data = await apiCall(url);
      setLeaderboard(data.leaderboard || []);
      setMyRank(data.myRank);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-amber-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-orange-500" />;
    return <span className="w-5 h-5 flex items-center justify-center font-medium text-slate-500">{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-200 dark:from-amber-900/30 dark:to-yellow-900/30 dark:border-amber-700/50';
    if (rank === 2) return 'bg-gradient-to-r from-slate-100 to-gray-100 border-slate-200 dark:from-slate-800 dark:to-gray-800 dark:border-slate-700';
    if (rank === 3) return 'bg-gradient-to-r from-orange-100 to-amber-100 border-orange-200 dark:from-orange-900/30 dark:to-amber-900/30 dark:border-orange-700/50';
    return 'bg-white border-slate-100 dark:bg-slate-900/60 dark:border-slate-800';
  };
  const myEntry = leaderboard.find(e => e.isMe);
  const myScore = myEntry ? myEntry.rankScore : 0;

  return (
    <div className="relative min-h-screen bg-background text-foreground transition-colors duration-500 overflow-x-hidden">
      {/* Background Decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-600 text-primary-foreground mb-8 overflow-hidden relative rounded-[2.5rem]">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />
          <CardContent className="p-8 sm:p-10 relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-md shadow-xl">
                  <span className="text-3xl font-black">#{myRank || ' - '}</span>
                </div>
                <div>
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Global Standing</p>
                  <p className="text-2xl font-black tracking-tight leading-none mb-2">{currentUser.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs font-bold">{currentUser.streak} Day Streak</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-5xl font-black tracking-tighter drop-shadow-md">{(myScore ?? 0).toFixed(0)}</p>
                <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em]">Efficiency Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 px-2">
          <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight">
            <div className="w-2 h-8 bg-primary rounded-full" />
            Hall of Fame
          </h2>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-full sm:w-[200px] glass border-border/50 rounded-2xl font-bold h-12 shadow-sm">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <SelectValue placeholder="All Subjects" />
              </div>
            </SelectTrigger>
            <SelectContent className="glass border-border/50 rounded-2xl p-1 shadow-2xl">
              <SelectItem value="overall" className="rounded-xl font-medium focus:bg-primary/10">Global Combined</SelectItem>
              <SelectItem value="physics" className="rounded-xl font-medium focus:bg-primary/10">Physics Arena</SelectItem>
              <SelectItem value="chemistry" className="rounded-xl font-medium focus:bg-primary/10">Chemistry Arena</SelectItem>
              <SelectItem value="mathematics" className="rounded-xl font-medium focus:bg-primary/10">Mathematics Arena</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-12">
          <TabsList className="bg-muted/50 p-1.5 w-full h-16 rounded-[2rem] glass border-border/30">
            <TabsTrigger
              value="global"
              className="flex-1 h-full rounded-[1.5rem] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-black text-xs uppercase tracking-widest transition-all gap-2"
            >
              <Globe className="w-4 h-4" />
              Global
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className="flex-1 h-full rounded-[1.5rem] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-black text-xs uppercase tracking-widest transition-all gap-2"
            >
              <MapPin className="w-4 h-4" />
              Local
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              className="flex-1 h-full rounded-[1.5rem] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-black text-xs uppercase tracking-widest transition-all gap-2"
            >
              <Users className="w-4 h-4" />
              Circle
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Top 3 Podium */}
            <div className="flex justify-center items-end gap-3 sm:gap-6 mb-16 mt-8">
              {leaderboard.slice(0, 3).map((entry, index) => (
                <div
                  key={entry.userId}
                  className={`flex flex-col items-center flex-1 max-w-[140px] group ${index === 0 ? 'order-2 scale-110 -translate-y-4' : index === 1 ? 'order-1' : 'order-3'
                    }`}
                >
                  <div className="relative">
                    <motion.div 
                      className={`absolute -inset-2 bg-gradient-to-br opacity-20 blur-xl rounded-full ${
                        index === 0 ? 'from-amber-400 to-yellow-500' :
                        index === 1 ? 'from-slate-400 to-slate-200' :
                        'from-orange-500 to-orange-300'
                      }`}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                    <Avatar className={`w-20 h-20 sm:w-28 sm:h-28 border-[6px] shadow-2xl relative z-10 ${
                      index === 0 ? 'border-amber-400' :
                      index === 1 ? 'border-slate-300' :
                      'border-orange-500'
                    }`}>
                      <AvatarFallback className={`text-2xl sm:text-3xl font-black ${
                        index === 0 ? 'bg-amber-100 text-amber-600' :
                        index === 1 ? 'bg-slate-100 text-slate-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        {(entry.name.charAt(0)).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-background z-20 ${
                      index === 0 ? 'bg-amber-400' :
                      index === 1 ? 'bg-slate-300' :
                      'bg-orange-500'
                    }`}>
                      <span className="text-white font-black text-base">{index + 1}</span>
                    </div>
                  </div>
                  <p className={`font-black mt-8 tracking-tight truncate w-full text-center group-hover:text-primary transition-colors ${index === 0 ? 'text-lg' : 'text-sm'}`}>
                    {entry.name}
                  </p>
                  <p className="text-xs font-black text-primary/80 mt-1">
                    {(entry.rankScore ?? 0).toFixed(0)} EFR
                  </p>
                </div>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted-foreground font-black uppercase text-xs tracking-[0.3em] animate-pulse">Syncing Arena Rankings</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-24 glass rounded-[3rem] border-dashed border-2 border-border/50">
                  <Trophy className="w-16 h-16 text-muted-foreground/10 mx-auto mb-6" />
                  <p className="text-muted-foreground font-black uppercase text-xs tracking-widest">No rankings detected</p>
                </div>
              ) : leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-5 p-5 sm:p-6 rounded-[2rem] border transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-primary/5 ${
                    entry.isMe 
                    ? 'glass border-primary/40 ring-2 ring-primary/20 shadow-xl' 
                    : 'bg-card border-border/50 shadow-sm'
                  }`}
                >
                  <div className="w-10 flex justify-center font-black text-xl tracking-tighter shrink-0">
                    {getRankIcon(entry.rank)}
                  </div>

                  <Avatar className="w-14 h-14 shadow-lg ring-2 ring-background border-2 border-transparent">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-blue-700 text-white font-black text-lg">
                      {entry.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-lg tracking-tight truncate">{entry.name}</span>
                      {entry.isMe && (
                        <Badge className="bg-primary hover:bg-primary text-white text-[10px] h-5 font-black uppercase tracking-wider px-2">YOU</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 font-black uppercase tracking-widest opacity-60">
                      <span>Efficiency: {(entry.rankScore ?? 0).toFixed(1)}%</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{entry.rawCount || 0} Modules</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-8 shrink-0">
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Growth</p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <Zap className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-sm font-black">+{(Math.random() * 10).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-primary leading-none tracking-tighter">{entry.questionsSolved || 0}</p>
                      <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mt-1">XP Points</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="local" className="mt-8">
            <Card className="border border-border shadow-xl bg-card/60 backdrop-blur-xl ring-1 ring-border">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-6 transition-transform hover:scale-110">
                  <MapPin className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Regional Ranking</h3>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto font-medium leading-relaxed">
                  Join your local network and see how you rank among students in your city.
                </p>
                <Button className="rounded-xl px-8 h-12 bg-primary text-primary-foreground font-black hover:scale-105 transition-all shadow-lg shadow-primary/20">
                  <MapPin className="w-5 h-5 mr-3" />
                  Enable Location
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="mt-8">
            <Card className="border border-border shadow-xl bg-card/60 backdrop-blur-xl ring-1 ring-border">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-secondary/20 flex items-center justify-center mb-6 transition-transform hover:scale-110">
                  <Users className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Social Circle</h3>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto font-medium leading-relaxed">
                   Competing with friends increases learning efficiency by 40%. Start your journey together.
                </p>
                <Button className="rounded-xl px-8 h-12 bg-primary text-primary-foreground font-black hover:scale-105 transition-all shadow-lg shadow-primary/20">
                  <Zap className="w-5 h-5 mr-3" />
                  Invite Friends
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
