'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Trash2, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  ListTodo, 
  Target, 
  Search,
  LayoutGrid,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Task, User } from '@/types';

interface TasksGoalsProps {
  tasks: Task[];
  onAddTask: (text: string, due: string) => void;
  onToggleTask: (id: number) => void;
  onRemoveTask: (id: number) => void;
  onBack: () => void;
  user: User;
}

export default function TasksGoals({ tasks, onAddTask, onToggleTask, onRemoveTask, onBack, user }: TasksGoalsProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDue, setNewTaskDue] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 16);
  });

  const filteredTasks = tasks.filter(t => {
    const matchesFilter = 
      filter === 'all' ? true : 
      filter === 'active' ? !t.completed : 
      t.completed;
    const matchesSearch = t.text.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => !t.completed && new Date(t.due).getTime() < Date.now()).length
  };

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    onAddTask(newTaskText.trim(), new Date(newTaskDue).toISOString());
    setNewTaskText('');
  };

  const isOverdue = (dateString: string) => {
    return new Date(dateString).getTime() < Date.now();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div id="tutorial-goals-hub" className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={onBack}
              className="group flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm hover:translate-x-[-4px] transition-transform"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                <Target className="w-8 h-8 text-white" />
              </div>
              Tasks & Goals
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium pl-14">
              Hey {user.name}, organize your study journey and stay on top of your milestones.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats Summary Tooltips could go here, but let's do a mini-card layout */}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Tasks', value: stats.total, icon: ListTodo, color: 'indigo' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'emerald' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'amber' },
            { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'rose' }
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900/20 flex items-center justify-center text-${stat.color}-600 dark:text-${stat.color}-400 mb-3 group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Task Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search your tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="flex bg-white dark:bg-slate-900/60 p-1.5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                {(['all', 'active', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      filter === f 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`group relative bg-white dark:bg-slate-900/60 p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                      task.completed 
                        ? 'border-slate-100 dark:border-white/5 opacity-60' 
                        : isOverdue(task.due)
                          ? 'border-rose-100 dark:border-rose-900/30'
                          : 'border-slate-100 dark:border-white/5 hover:border-indigo-200 dark:hover:border-indigo-900/30'
                    }`}
                  >
                    <button 
                      onClick={() => onToggleTask(task.id)}
                      className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        task.completed 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/10' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 ${task.completed ? 'block' : 'hidden md:block opacity-0 group-hover:opacity-30'}`} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <h4 className={`text-base font-bold transition-all ${
                        task.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'
                      }`}>
                        {task.text}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <Badge variant="outline" className={`h-6 px-2 border-0 font-bold text-[10px] uppercase tracking-wider ${
                          task.completed 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' 
                            : isOverdue(task.due)
                              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600'
                              : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          <Calendar className="w-3 h-3 mr-1.5" />
                          {task.completed ? 'Completed' : isOverdue(task.due) ? `Missed: ${formatDate(task.due)}` : `Due: ${formatDate(task.due)}`}
                        </Badge>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveTask(task.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredTasks.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                    <LayoutGrid className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">No tasks found</h3>
                    <p className="text-sm text-slate-500">Try adjusting your filters or search query.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: New Task Form */}
          <div className="space-y-6">
            <Card className="border-0 shadow-2xl shadow-indigo-500/5 bg-white dark:bg-slate-900/60 backdrop-blur-xl relative overflow-hidden rounded-[2rem] ring-1 ring-slate-100 dark:ring-white/5 sticky top-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16" />
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Add New Task</h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest italic">Break down your goals</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Task Description</label>
                    <textarea 
                      placeholder="What needs to be done?"
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Deadline</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input 
                        type="datetime-local" 
                        value={newTaskDue}
                        onChange={(e) => setNewTaskDue(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddTask}
                    disabled={!newTaskText.trim()}
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl shadow-indigo-500/30 text-base font-black gap-2 group"
                  >
                    Create Task
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-2">💡 Quick Tip</p>
                  <p className="text-xs text-indigo-900/60 dark:text-indigo-300 font-medium leading-relaxed">
                    Setting specific deadlines helps you stay disciplined and focused on your learning objectives.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
