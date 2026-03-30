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
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-900/30">

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] dark:from-teal-600 dark:to-slate-900 text-white mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <span className="text-2xl font-bold">#{myRank || ' - '}</span>
                </div>
                <div>
                  <p className="text-white/70 text-sm">Your {selectedSubject === 'overall' ? 'Global' : selectedSubject} Rank</p>
                  <p className="text-xl font-semibold">{currentUser.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Flame className="w-4 h-4 text-orange-300" />
                    <span className="text-sm">{currentUser.streak} day streak</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{myScore.toFixed(3)}</p>
                <p className="text-white/70 text-sm">Efficiency Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#3CACA3]" />
            Ranking Category
          </h2>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[180px] bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl">
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 w-full">
            <TabsTrigger
              value="global"
              className="flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-[#3CACA3] dark:data-[state=active]:text-teal-400 dark:text-slate-400"
            >
              <Globe className="w-4 h-4 mr-2" />
              Global
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className="flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-[#3CACA3] dark:data-[state=active]:text-teal-400 dark:text-slate-400"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Near You
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              className="flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-[#3CACA3] dark:data-[state=active]:text-teal-400 dark:text-slate-400"
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
                    <Avatar className={`w-full h-full border-4 shadow-xl ${index === 0 ? 'border-amber-400' :
                      index === 1 ? 'border-slate-400' :
                        'border-orange-400'
                      }`}>
                      <AvatarFallback className={`text-xl sm:text-2xl font-bold ${index === 0 ? 'bg-amber-100 text-amber-600' :
                        index === 1 ? 'bg-slate-100 text-slate-600' :
                          'bg-orange-100 text-orange-600'
                        }`}>
                        {(entry.avatar || entry.name.charAt(0)).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${index === 0 ? 'bg-amber-400' :
                      index === 1 ? 'bg-slate-400' :
                        'bg-orange-400'
                      }`}>
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                  </div>
                  <p className={`font-bold mt-6 text-slate-900 dark:text-white truncate w-full text-center ${index === 0 ? 'text-lg' : 'text-sm'}`}>
                    {entry.name}
                  </p>
                  <Badge variant="outline" className="mt-1 text-[10px] font-bold text-[#3CACA3]">
                    {(entry.rankScore ?? 0).toFixed(3)}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-[#3CACA3]/30 border-t-[#3CACA3] rounded-full animate-spin" />
                  <p className="text-slate-500 font-medium">Climbing the ranks...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No data found for this category yet.</p>
                </div>
              ) : leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all hover:translate-x-1 ${getRankStyle(entry.rank)} ${entry.isMe ? 'ring-2 ring-[#3CACA3]' : ''}`}
                >
                  <div className="w-8 flex justify-center">
                    {getRankIcon(entry.rank)}
                  </div>

                  <Avatar className="w-12 h-12 shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] text-white font-bold">
                      {entry.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{entry.name}</span>
                      {entry.isMe && (
                        <Badge className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] h-5">YOU</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1 font-medium italic">
                        Efficiency Score: {(entry.rankScore ?? 0).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right min-w-[80px] flex gap-4 items-center">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-400">{entry.rawCount || 0}</p>
                      <p className="text-[10px] text-slate-500 uppercase">Solved</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#3CACA3] dark:text-teal-400">{entry.questionsSolved}</p>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Points</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="local" className="mt-6">
            <Card className="border-0 shadow-soft dark:bg-slate-900 dark:border dark:border-slate-800">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#3CACA3]/10 dark:bg-teal-500/10 flex items-center justify-center mb-4">
                  <MapPin className="w-10 h-10 text-[#3CACA3] dark:text-teal-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Students Near You</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  See how you rank among students in your city. Enable location to view local leaderboard.
                </p>
                <Button className="rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] dark:from-teal-600 dark:to-slate-800 text-white">
                  <MapPin className="w-4 h-4 mr-2" />
                  Enable Location
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="mt-6">
            <Card className="border-0 shadow-soft dark:bg-slate-900 dark:border dark:border-slate-800">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#3CACA3]/10 dark:bg-teal-500/10 flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-[#3CACA3] dark:text-teal-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Friend Leaderboard</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Invite your friends and compete together! Learning is more fun with friends.
                </p>
                <Button className="rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] dark:from-teal-600 dark:to-slate-800 text-white">
                  <Zap className="w-4 h-4 mr-2" />
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
