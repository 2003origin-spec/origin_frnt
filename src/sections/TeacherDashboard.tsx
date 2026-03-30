'use client';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    Calendar,
    Plus,
    MoreVertical,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Copy,
    Mail,
    UserCircle,
    Camera
} from 'lucide-react';
import type { User, Classroom } from '@/types';
import { toast } from 'sonner';

interface TeacherDashboardProps {
    user: User;
}

// Mock Data for Teacher Dashboard
const mockClassrooms: Classroom[] = [
    {
        id: 'c1',
        name: 'Class 12 - Physics A',
        subject: 'Physics',
        schedule: 'Mon, Wed, Fri - 10:00 AM',
        studentCount: 42,
        avgAttendance: 94,
        students: []
    },
    {
        id: 'c2',
        name: 'Class 11 - JEE Advanced',
        subject: 'Physics',
        schedule: 'Tue, Thu - 2:00 PM',
        studentCount: 35,
        avgAttendance: 88,
        students: []
    },
    {
        id: 'c3',
        name: 'Class 12 - Doubt Session',
        subject: 'Physics',
        schedule: 'Sat - 11:00 AM',
        studentCount: 15,
        avgAttendance: 98,
        students: []
    }
];

export default function TeacherDashboard({ user }: { user: User }) {
    const [classrooms, setClassrooms] = useState<Classroom[]>(mockClassrooms);
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);

    // Create Class Form State
    const [newClassName, setNewClassName] = useState('');
    const [newClassSubject, setNewClassSubject] = useState('');
    const [newClassSchedule, setNewClassSchedule] = useState('');
    const [iscreateClassOpen, setIsCreateClassOpen] = useState(false);

    // Add Student Form State
    const [inviteEmail, setInviteEmail] = useState('');
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

    // Removal of profileMenuRef logic as TopBar is now global

    const handleCreateClass = (e: React.FormEvent) => {
        e.preventDefault();
        const newClass: Classroom = {
            id: `c${Date.now()}`,
            name: newClassName,
            subject: newClassSubject,
            schedule: newClassSchedule,
            studentCount: 0,
            avgAttendance: 0,
            students: []
        };
        setClassrooms([...classrooms, newClass]);
        setIsCreateClassOpen(false);
        toast.success('Classroom created successfully!');
        setNewClassName('');
        setNewClassSubject('');
        setNewClassSchedule('');
    };

    const handleAddStudent = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, this would send an invite
        toast.success(`Invite sent to ${inviteEmail}`);
        setIsAddStudentOpen(false);
        setInviteEmail('');
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(`https://origin.app/join/${selectedClassroom?.id}`);
        toast.success('Invite link copied to clipboard');
    };

    return (
        <div className="min-h-screen bg-[#F0F4F8] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-50 selection:bg-teal-100 selection:text-teal-900 transition-colors duration-300">

            {/* Decorative Background */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40 dark:opacity-0 transition-opacity">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-teal-200/30 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[120px]" />
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">

                {/* Welcome Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                            Hello, <span className="text-[#3CACA3]">{user.name.split(' ')[0]}</span> 👋
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                            Here's what's happening in your classrooms today.
                        </p>
                    </div>

                    <Dialog open={iscreateClassOpen} onOpenChange={setIsCreateClassOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-[#3CACA3] to-[#2C8C85] hover:opacity-90 text-white shadow-lg shadow-teal-500/20 rounded-xl px-6">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Classroom
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800">
                            <DialogHeader>
                                <DialogTitle>Create New Classroom</DialogTitle>
                                <DialogDescription>Add a new class to organize your students.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateClass} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="className">Class Name</Label>
                                    <Input
                                        id="className"
                                        placeholder="e.g. Class 12 - Physics Batch A"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="e.g. Physics"
                                        value={newClassSubject}
                                        onChange={(e) => setNewClassSubject(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="schedule">Schedule</Label>
                                    <Input
                                        id="schedule"
                                        placeholder="e.g. Mon, Wed, Fri - 10:00 AM"
                                        value={newClassSchedule}
                                        onChange={(e) => setNewClassSchedule(e.target.value)}
                                        required
                                    />
                                </div>
                                <DialogFooter className="mt-6">
                                    <Button type="submit" className="w-full bg-[#3CACA3] text-white hover:bg-[#2C8C85]">Create Class</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Tabs defaultValue="classrooms" className="w-full">
                    <TabsList className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md p-1 mb-8 rounded-2xl w-full flex justify-start overflow-x-auto">
                        <TabsTrigger value="classrooms" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3CACA3] data-[state=active]:to-[#2C8C85] data-[state=active]:text-white rounded-xl px-6 py-2">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Classrooms Overview
                        </TabsTrigger>
                        <TabsTrigger value="avatar" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3CACA3] data-[state=active]:to-[#2C8C85] data-[state=active]:text-white rounded-xl px-6 py-2">
                            <UserCircle className="w-4 h-4 mr-2" />
                            Create your own avatar
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="classrooms" className="space-y-8 mt-0 border-0 p-0">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Students', value: '92', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                { label: 'Active Classes', value: classrooms.length.toString(), icon: LayoutDashboard, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                                { label: 'Avg Attendance', value: '94%', icon: CheckCircle2, color: 'text-teal-500', bg: 'bg-teal-500/10' },
                                { label: 'Pending Doubts', value: '12', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                            ].map((stat, i) => (
                                <Card key={i} className="border-0 shadow-sm bg-white/60 dark:bg-slate-900/40 backdrop-blur-md">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</h3>
                                        </div>
                                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* AI Insight Placeholder - Futuristic Element */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-1">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
                            <div className="relative bg-slate-950/20 backdrop-blur-sm p-6 rounded-xl flex items-center justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                                        <SparklesIcon className="w-6 h-6 text-yellow-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-1">AI Class Insight</h3>
                                        <p className="text-indigo-100 text-sm max-w-2xl leading-relaxed">
                                            3 students in <span className="font-semibold text-white">Class 12 - Physics A</span> are showing a downward trend in mechanics scores.
                                            Consider scheduling a remedial session for "Rotational Motion".
                                        </p>
                                    </div>
                                </div>
                                <Button variant="secondary" className="hidden md:flex bg-white text-indigo-700 hover:bg-indigo-50 border-0">
                                    View Analysis
                                </Button>
                            </div>
                        </div>

                        {/* Classrooms Grid */}
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-[#3CACA3]" />
                                Your Classrooms
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {classrooms.map((classroom) => (
                                    <Card key={classroom.id} className="group border-0 shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900/60 backdrop-blur-xl relative overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[#3CACA3] group-hover:w-2 transition-all duration-300" />
                                        <CardHeader className="pb-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <Badge variant="outline" className="mb-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-normal">
                                                        {classroom.subject}
                                                    </Badge>
                                                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                        {classroom.name}
                                                    </CardTitle>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <CardDescription className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400 text-sm">
                                                <Calendar className="w-4 h-4" />
                                                {classroom.schedule}
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-[#3CACA3]" />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{classroom.studentCount} Students</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{classroom.avgAttendance}% Att.</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Dialog open={isAddStudentOpen && selectedClassroom?.id === classroom.id} onOpenChange={(open) => {
                                                    setIsAddStudentOpen(open);
                                                    if (open) setSelectedClassroom(classroom);
                                                }}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" className="flex-1 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300">
                                                            Add Student
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 backdrop-blur-xl border-slate-200 dark:border-slate-800">
                                                        <DialogHeader>
                                                            <DialogTitle>Add Student to {classroom.name}</DialogTitle>
                                                            <DialogDescription>Invite a student via email or share the link</DialogDescription>
                                                        </DialogHeader>
                                                        <div className="space-y-4 py-4">
                                                            <div className="space-y-2">
                                                                <Label>Invite via Email</Label>
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        placeholder="student@example.com"
                                                                        value={inviteEmail}
                                                                        onChange={(e) => setInviteEmail(e.target.value)}
                                                                    />
                                                                    <Button onClick={handleAddStudent} size="icon" className="bg-[#3CACA3] hover:bg-[#2C8C85]">
                                                                        <Mail className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <div className="relative">
                                                                <div className="absolute inset-0 flex items-center">
                                                                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                                                                </div>
                                                                <div className="relative flex justify-center text-xs uppercase">
                                                                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">Or share link</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                <code className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">
                                                                    https://origin.app/join/{classroom.id}
                                                                </code>
                                                                <Button variant="ghost" size="sm" onClick={copyInviteLink} className="h-8 w-8 p-0">
                                                                    <Copy className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>

                                                <Button className="flex-1 bg-[#3CACA3]/10 text-[#3CACA3] hover:bg-[#3CACA3]/20 border border-[#3CACA3]/20 shadow-none">
                                                    Manage
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {/* Empty State / Add New Card */}
                                <button
                                    onClick={() => setIsCreateClassOpen(true)}
                                    className="flex flex-col items-center justify-center h-full min-h-[220px] rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:text-[#3CACA3] hover:border-[#3CACA3]/50 hover:bg-[#3CACA3]/5 transition-all group"
                                >
                                    <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 group-hover:bg-[#3CACA3]/10 mb-4 transition-colors">
                                        <Plus className="w-6 h-6" />
                                    </div>
                                    <p className="font-medium text-sm">Create New Classroom</p>
                                </button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="avatar">
                        <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900/60 backdrop-blur-xl">
                            <CardContent className="p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                                <div className="w-32 h-32 bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] rounded-full mb-8 flex items-center justify-center shadow-xl shadow-teal-500/20 relative overflow-hidden group border-4 border-white dark:border-slate-800">
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="w-8 h-8 text-white" />
                                    </div>
                                    <UserCircle className="w-16 h-16 text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Create Your Interactive AI Avatar</h2>
                                <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-8 text-lg">
                                    Make your virtual classroom more engaging. Upload a video of yourself or use your webcam to generate a lifelike AI avatar that can deliver lectures dynamically.
                                </p>
                                <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-md mx-auto">
                                    <Button className="flex-1 bg-gradient-to-r from-[#3CACA3] to-[#2C8C85] text-white hover:opacity-90 shadow-lg shadow-teal-500/20 py-6 text-base">
                                        <Camera className="w-5 h-5 mr-2" />
                                        Launch Creator Studio
                                    </Button>
                                    <Button variant="outline" className="flex-1 py-6 text-base border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                                        Upload Video
                                    </Button>
                                </div>
                                <div className="mt-12 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-100 dark:border-teal-900/50 inline-flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                    <span className="text-teal-700 dark:text-teal-300 text-sm font-medium">Avatar Studio v2.0 is now live with improved lip-sync accuracy</span>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

            </main>
        </div>
    );
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
    );
}
