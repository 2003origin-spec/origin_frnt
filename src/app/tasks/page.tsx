'use client';

import TasksGoals from '@/sections/TasksGoals';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function TasksPage() {
  const { user, tasks, addTask, toggleTask, removeTask } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <TasksGoals
      user={user}
      tasks={tasks}
      onAddTask={addTask}
      onToggleTask={toggleTask}
      onRemoveTask={removeTask}
      onBack={() => router.back()}
    />
  );
}
