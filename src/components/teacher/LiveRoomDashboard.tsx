"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Users, Square, Award, Globe, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherRoomSummary } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
};

type StudentPresence = {
  id: string;
  name: string;
  status: "active" | "idle" | "submitted" | "disconnected";
  score: number;
  progress: number; // percentage of questions solved
  speedSeconds: number;
};

export function LiveRoomDashboard({ workspaceId, room: initialRoom }: Props) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [pending, startTransition] = useTransition();

  // Compute real time remaining from room.startedAt + room.durationSeconds
  const computeTimeLeft = (r: typeof initialRoom) => {
    if (!r.durationSeconds || !r.startedAt) return 3600;
    const elapsed = Math.floor((Date.now() - new Date(r.startedAt).getTime()) / 1000);
    return Math.max(0, r.durationSeconds - elapsed);
  };

  const [timeLeft, setTimeLeft] = useState<number>(() => computeTimeLeft(initialRoom));

  // Real participants from backend; fall back to empty list
  const [students, setStudents] = useState<StudentPresence[]>([]);

  const mapParticipantToPresence = (p: any): StudentPresence => {
    let status: StudentPresence["status"] = "active";
    if (p.kicked || p.left_at) status = "disconnected";
    else if (p.finished_at) status = "submitted";
    else if (p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() > 30_000) status = "idle";
    return {
      id: p.user_id,
      name: p.display_name,
      status,
      score: p.score ?? 0,
      progress: p.finished_at ? 100 : 0,
      speedSeconds: p.time_taken_seconds ?? 0,
    };
  };

  // Poll participants every 10 seconds
  useEffect(() => {
    const fetchParticipants = async () => {
      const result = await apiJson<{ participants: any[] }>(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}/participants`
      );
      if (result.ok) {
        setStudents(result.data.participants.map(mapParticipantToPresence));
      }
    };
    fetchParticipants();
    const poll = setInterval(fetchParticipants, 10_000);
    return () => clearInterval(poll);
  }, [workspaceId, room.id]);

  // Live countdown timer ticking down
  useEffect(() => {
    if (timeLeft <= 0 || room.status === "closed") return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, room.status]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  async function handleCloseRoom() {
    if (!confirm("Are you sure you want to end this live study room session?")) return;
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}`,
        { method: "DELETE" }
      );
      if (result.ok) {
        toast.success("Live study room closed successfully");
        setRoom(prev => ({ ...prev, status: "closed" as const }));
        router.push(`/teacher/workspaces/${workspaceId}/rooms`);
        router.refresh();
      } else {
        toast.error("Failed to close live room");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* RoomHeaderWidget */}
      <div className="rounded-3xl border border-border bg-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
              Live Session
            </span>
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Room Code: {room.id}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">{room.name}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" /> {students.filter(s => s.status !== "disconnected").length} students online
          </p>
        </div>

        {/* Live ticking countdown timer */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-muted/20 px-4 py-2 border rounded-2xl w-full sm:w-auto justify-center">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-mono text-xl font-bold tracking-widest">{formatTime(timeLeft)}</span>
          </div>

          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={handleCloseRoom}
            className="h-10 rounded-xl gap-1.5 font-bold"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            End Test
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Side: Presence */}
        <div className="lg:col-span-2 space-y-6">
          {/* PresenceGrid */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" /> Student Presence Matrix
              </CardTitle>
              <CardDescription>Live proctoring tiles tracking network statuses.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {students.map((student) => (
                  <div key={student.id} className="p-3 border rounded-xl bg-card flex items-center gap-2.5">
                    {/* Status Dot */}
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      student.status === "active" 
                        ? "bg-emerald-500 animate-pulse" 
                        : student.status === "idle"
                        ? "bg-amber-500"
                        : student.status === "submitted"
                        ? "bg-gray-400"
                        : "bg-destructive animate-pulse"
                    }`} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate">{student.name}</span>
                      <span className="text-[9px] text-muted-foreground capitalize">{student.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: LiveLeaderboard */}
        <div className="lg:col-span-1">
          <Card className="border h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Live Leaderboard
              </CardTitle>
              <CardDescription>Real-time mock test rankings</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto divide-y pr-1">
              {students
                .sort((a, b) => b.score - a.score)
                .map((student, idx) => (
                  <div key={student.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        idx === 0 
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" 
                          : "bg-muted text-muted-foreground"
                      }`}>{idx + 1}</span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{student.name}</span>
                        <span className="text-[10px] text-muted-foreground">{student.progress}% solved · {student.speedSeconds}s/q</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">{student.score} pts</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
