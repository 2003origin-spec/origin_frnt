'use client';
import { useState, useEffect } from 'react';
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
}

export default function Leaderboard({ currentUser }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState('global');
  const [selectedSubject, setSelectedSubject] = useState<string>('overall');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedSubject]);

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
    <div className="relative min-h-screen bg-background text-foreground transition-colors duration-300">

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-0 shadow-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground mb-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />
          <CardContent className="p-8 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-md">
                  <span className="text-2xl font-black">#{myRank || ' - '}</span>
                </div>
                <div>
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Global Rank</p>
                  <p className="text-xl font-black tracking-tight">{currentUser.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-bold">{currentUser.streak} Day Streak</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black tracking-tighter">{(myScore ?? 0).toFixed(2)}</p>
                <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Efficiency Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-black flex items-center gap-3 uppercase tracking-tight">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            Live Rankings
          </h2>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[180px] bg-card border-border rounded-xl font-bold">
              <SelectValue placeholder="Select Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall">Overall (Global)</SelectItem>
              <SelectItem value="physics">Physics</SelectItem>
              <SelectItem value="chemistry">Chemistry</SelectItem>
              <SelectItem value="mathematics">Mathematics</SelectItem>
              <SelectItem value="biology">Biology</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-10">
          <TabsList className="bg-muted p-1.5 w-full h-14 rounded-2xl backdrop-blur-md">
            <TabsTrigger
              value="global"
              className="flex-1 h-full rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-bold text-sm tracking-tight transition-all"
            >
              <Globe className="w-4 h-4 mr-2" />
              Global
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className="flex-1 h-full rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-bold text-sm tracking-tight transition-all"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Local
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              className="flex-1 h-full rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-bold text-sm tracking-tight transition-all"
            >
              <Users className="w-4 h-4 mr-2" />
              Friends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-6">
            {/* Top 3 Podium */}
            <div className="flex justify-center items-end gap-2 sm:gap-4 mb-10 mt-4">
              {leaderboard.slice(0, 3).map((entry, index) => (
                <div
                  key={entry.userId}
                  className={`flex flex-col items-center flex-1 max-w-[120px] ${index === 0 ? 'order-2 scale-110 mb-4' : index === 1 ? 'order-1' : 'order-3'
                    }`}
                >
                  <div className={`relative ${index === 0 ? 'w-20 h-20 sm:w-28 sm:h-28' : 'w-16 h-16 sm:w-24 sm:h-24'
                    }`}>
                    <Avatar className={`w-full h-full border-4 shadow-xl ring-4 ring-background ${index === 0 ? 'border-amber-400' :
                      index === 1 ? 'border-zinc-400' :
                        'border-orange-400'
                      }`}>
                      <AvatarFallback className={`text-xl sm:text-2xl font-black ${index === 0 ? 'bg-amber-100 text-amber-600' :
                        index === 1 ? 'bg-zinc-100 text-zinc-600' :
                          'bg-orange-100 text-orange-600'
                        }`}>
                        {(entry.avatar || entry.name.charAt(0)).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ring-2 ring-background ${index === 0 ? 'bg-amber-400' :
                      index === 1 ? 'bg-zinc-400' :
                        'bg-orange-400'
                      }`}>
                      <span className="text-white font-black text-sm">{index + 1}</span>
                    </div>
                  </div>
                  <p className={`font-black mt-6 tracking-tight truncate w-full text-center ${index === 0 ? 'text-lg' : 'text-sm'}`}>
                    {entry.name}
                  </p>
                  <Badge variant="secondary" className="mt-1 text-[10px] font-black uppercase text-primary border-primary/20">
                    {(entry.rankScore ?? 0).toFixed(2)} pts
                  </Badge>
                </div>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Updating Leaderboard...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-24 bg-card rounded-[2.5rem] border-2 border-dashed border-border ring-1 ring-border">
                  <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-6" />
                  <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No rankings found yet</p>
                </div>
              ) : leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 p-5 rounded-2xl border border-border shadow-sm transition-all hover:translate-x-1 hover:shadow-md ${entry.isMe ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-card'}`}
                >
                  <div className="w-10 flex justify-center font-black text-lg tracking-tighter">
                    {getRankIcon(entry.rank)}
                  </div>

                  <Avatar className="w-12 h-12 shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] text-white font-bold">
                      {entry.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black tracking-tight">{entry.name}</span>
                      {entry.isMe && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] h-5 font-black uppercase">YOU</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 font-bold uppercase tracking-widest">
                      <span>Efficiency: {(entry.rankScore ?? 0).toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="text-right flex gap-6 items-center">
                    <div className="text-right">
                      <p className="text-sm font-black tracking-tight">{entry.rawCount || 0}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Tests</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-primary leading-none">{entry.questionsSolved}</p>
                      <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter mt-1">Points</p>
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
